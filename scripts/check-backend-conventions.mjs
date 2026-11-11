import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const routeMethods = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options', 'All']);
const mutations = new Set(['Post', 'Put', 'Patch', 'Delete', 'All']);
const statusCodes = { OK: 200, CREATED: 201, ACCEPTED: 202, NO_CONTENT: 204 };
const portable = (value) => value.replaceAll('\\', '/');

function normalized(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  const tokens = [];
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) tokens.push(scanner.getTokenText());
  return tokens.join('\0');
}

function fingerprint(source, owner, method) {
  const context = [
    ...(ts.getDecorators(owner) ?? []).map((d) => d.getText(source)),
    method.getText(source),
  ].join('\n');
  return createHash('sha256').update(normalized(context)).digest('hex');
}

/** Declarative API conventions, not a proof of authorization or validation behavior. */
export function checkBackendConventions(root = projectRoot, { baseline, routePolicy } = {}) {
  root = resolve(root);
  const policyPath = resolve(root, 'scripts/backend-route-policy.json');
  routePolicy ??= existsSync(policyPath)
    ? JSON.parse(readFileSync(policyPath, 'utf8'))
    : { publicHandlers: [], memberMutations: [] };
  const handlerKey = (file, symbol) => `${file}#${symbol}`;
  const policies = {};
  for (const kind of ['publicHandlers', 'memberMutations']) {
    if (!Array.isArray(routePolicy[kind])) throw Error(`Route policy needs a ${kind} array.`);
    policies[kind] = new Set();
    for (const entry of routePolicy[kind]) {
      if (
        typeof entry.file !== 'string' ||
        !entry.file.startsWith('src/modules/') ||
        !entry.file.endsWith('.controller.ts') ||
        portable(relative(root, resolve(root, entry.file))) !== entry.file ||
        !/^[A-Za-z]\w*\.[A-Za-z]\w*$/.test(entry.symbol ?? '') ||
        typeof entry.reason !== 'string' ||
        !entry.reason.trim()
      )
        throw Error('Route policy requires an exact controller path, handler symbol and reason.');
      const key = handlerKey(entry.file, entry.symbol);
      if (policies[kind].has(key)) throw Error(`Duplicate route policy: ${key}`);
      policies[kind].add(key);
    }
  }
  for (const key of policies.publicHandlers)
    if (policies.memberMutations.has(key)) throw Error(`Conflicting route policy: ${key}`);
  const observedPolicies = { publicHandlers: new Set(), memberMutations: new Set() };
  const configPath = resolve(root, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  if (parsed.errors.length)
    throw Error(
      parsed.errors.map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'),
    );
  const files = ts.sys.readDirectory(
    resolve(root, 'src'),
    ['.ts'],
    ['**/generated/**', '**/*.spec.ts', '**/_test/**', '**/*.d.ts'],
  );
  const program = ts.createProgram(files, parsed.options);
  const checker = program.getTypeChecker();
  const violations = [];

  for (const file of files) {
    const source = program.getSourceFile(file);
    const ownerPath = portable(relative(root, file));
    const imports = new Map();
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier))
        continue;
      const module = statement.moduleSpecifier.text;
      const resolved = ts.resolveModuleName(module, file, parsed.options, ts.sys).resolvedModule;
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const item of bindings.elements)
          imports.set(item.name.text, {
            name: (item.propertyName ?? item.name).text,
            module,
            resolved: resolved?.resolvedFileName,
            typeOnly: !!(statement.importClause.isTypeOnly || item.isTypeOnly),
          });
      }
      if (bindings && ts.isNamespaceImport(bindings))
        imports.set(bindings.name.text, {
          module,
          resolved: resolved?.resolvedFileName,
          namespace: true,
          typeOnly: !!statement.importClause.isTypeOnly,
        });
    }
    const decorators = (node) =>
      (ts.getDecorators(node) ?? []).flatMap((decorator) => {
        const call = decorator.expression;
        if (!ts.isCallExpression(call)) return [];
        const target = call.expression;
        let imported;
        if (ts.isIdentifier(target)) imported = imports.get(target.text);
        if (ts.isPropertyAccessExpression(target) && ts.isIdentifier(target.expression)) {
          const namespace = imports.get(target.expression.text);
          if (namespace?.namespace) imported = { ...namespace, name: target.name.text };
        }
        if (!imported || imported.typeOnly) return [];
        const local = portable(imported.resolved ?? '');
        const trusted =
          ['@nestjs/common', '@nestjs/swagger'].includes(imported.module) ||
          local === portable(resolve(root, 'src/auth/decorators/auth-api.decorator.ts')) ||
          local === portable(resolve(root, 'src/auth/decorators/roles.decorator.ts')) ||
          local === portable(resolve(root, 'src/common/swagger/decorators/api-envelope.decorator.ts')) ||
          local === portable(resolve(root, 'src/common/decorators/api-response.decorator.ts'));
        return trusted ? [{ name: imported.name, call }] : [];
      });
    const report = (node, rule, message, symbol, hash) =>
      violations.push({
        file: ownerPath,
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        rule,
        symbol,
        fingerprint: hash,
        message,
      });
    if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.ts$/.test(basename(file))) {
      report(
        source,
        'file-naming',
        'Use lower-case kebab-case file names with role suffixes.',
        basename(file),
      );
    }
    for (const owner of source.statements.filter(ts.isClassDeclaration)) {
      const classDecorators = decorators(owner);
      const hasClass = (name) => classDecorators.some((d) => d.name === name);
      const suffix = [
        ['.controller.ts', 'Controller'],
        ['.service.ts', 'Service'],
        ['.module.ts', 'Module'],
      ].find(([ending]) => file.endsWith(ending));
      if (suffix && owner.name && !owner.name.text.endsWith(suffix[1])) {
        report(
          owner,
          'class-naming',
          `A ${suffix[0]} class must end in ${suffix[1]}.`,
          owner.name.text,
        );
      }
      if (!hasClass('Controller')) continue;
      for (const method of owner.members.filter(ts.isMethodDeclaration)) {
        const methodDecorators = decorators(method);
        const route = methodDecorators.find((d) => routeMethods.has(d.name));
        if (!route) continue;
        const has = (name) => hasClass(name) || methodDecorators.some((d) => d.name === name);
        const symbol = `${owner.name?.text}.${method.name.getText(source)}`;
        const hash = fingerprint(source, owner, method);
        const fail = (rule, message, node = method) => report(node, rule, message, symbol, hash);
        if (!has('ProtectedApi') && !has('PublicApi'))
          fail('route-auth', 'Declare @ProtectedApi() or @PublicApi().');
        const key = handlerKey(ownerPath, symbol);
        if (has('PublicApi')) observedPolicies.publicHandlers.add(key);
        if (has('ProtectedApi') && !has('PublicApi') && mutations.has(route.name))
          observedPolicies.memberMutations.add(key);
        if (has('PublicApi') && !policies.publicHandlers.has(key))
          fail(
            'public-route-policy',
            'Public access requires an exact reviewed entry in scripts/backend-route-policy.json.',
          );
        if (has('ProtectedApi') && has('PublicApi'))
          fail('conflicting-auth', 'Do not combine public and protected metadata.');
        // Self-service member mutations are explicitly listed, never exempted by folder name.
        const memberMutation = policies.memberMutations.has(key);
        const effectiveRoles =
          methodDecorators.find((d) => d.name === 'Roles') ??
          classDecorators.find((d) => d.name === 'Roles');
        const emptyRoles =
          effectiveRoles &&
          effectiveRoles.call.arguments.every(
            (arg) =>
              ts.isSpreadElement(arg) &&
              ts.isArrayLiteralExpression(arg.expression) &&
              arg.expression.elements.length === 0,
          );
        if (
          mutations.has(route.name) &&
          !memberMutation &&
          !has('PublicApi') &&
          (!effectiveRoles || emptyRoles)
        )
          fail(
            'mutation-policy',
            'Declare an explicit nonempty @Roles policy for the business mutation.',
          );
        if (!has('ApiOperation'))
          fail('route-documentation', 'Document the operation with @ApiOperation().');

        const httpCode = methodDecorators.find((d) => d.name === 'HttpCode')?.call.arguments[0];
        const numericStatus = (node) => {
          if (!node) return undefined;
          if (ts.isNumericLiteral(node)) return Number(node.text);
          if (!ts.isPropertyAccessExpression(node)) return undefined;
          const object = node.expression;
          const imported = ts.isIdentifier(object) ? imports.get(object.text) : undefined;
          if (imported?.name === 'HttpStatus' && imported.module === '@nestjs/common')
            return statusCodes[node.name.text];
          if (
            ts.isPropertyAccessExpression(object) &&
            ts.isIdentifier(object.expression) &&
            object.name.text === 'HttpStatus'
          ) {
            const namespace = imports.get(object.expression.text);
            if (namespace?.namespace && namespace.module === '@nestjs/common')
              return statusCodes[node.name.text];
          }
          return undefined;
        };
        const actualStatus =
          numericStatus(httpCode) ?? (httpCode ? undefined : route.name === 'Post' ? 201 : 200);
        const envelope = methodDecorators.find((d) => d.name === 'ApiEnvelope');
        const binary = has('SkipApiResponse') && has('ApiProduces');
        if (!envelope && !binary && !(actualStatus === 204 && has('ApiNoContentResponse'))) {
          fail(
            'response-contract',
            'Document JSON with @ApiEnvelope(), or an explicit binary/no-content contract.',
          );
        }
        if (envelope) {
          const model = envelope.call.arguments[0];
          let responseSymbol = model && checker.getSymbolAtLocation(model);
          if (responseSymbol && responseSymbol.flags & ts.SymbolFlags.Alias)
            responseSymbol = checker.getAliasedSymbol(responseSymbol);
          if (
            !responseSymbol?.declarations?.some(
              (declaration) =>
                ts.isClassDeclaration(declaration) && declaration.name?.text.endsWith('Dto'),
            )
          )
            fail('response-dto', '@ApiEnvelope() must reference a concrete response DTO class.');
          if (actualStatus === 204)
            fail('response-contract', 'A 204 response cannot have a JSON envelope.');
          const options = envelope.call.arguments[1];
          const status =
            options &&
            ts.isObjectLiteralExpression(options) &&
            options.properties.find(
              (p) => ts.isPropertyAssignment(p) && p.name.getText(source) === 'status',
            );
          const dynamicOptions =
            options &&
            (!ts.isObjectLiteralExpression(options) ||
              options.properties.some(ts.isSpreadAssignment));
          const declaredStatus = status
            ? numericStatus(status.initializer)
            : dynamicOptions
              ? undefined
              : 200;
          if (
            actualStatus !== undefined &&
            declaredStatus !== undefined &&
            actualStatus !== declaredStatus
          ) {
            fail(
              'response-status',
              `Runtime status ${actualStatus} differs from @ApiEnvelope status ${declaredStatus}.`,
            );
          }
        }

        for (const param of method.parameters) {
          const binding = decorators(param).find((d) => ['Body', 'Query'].includes(d.name));
          if (!binding) continue;
          if (binding.call.arguments.length && ts.isStringLiteralLike(binding.call.arguments[0]))
            continue;
          const type = param.type;
          let dto = false;
          if (type && ts.isTypeReferenceNode(type)) {
            const name = type.typeName;
            let rootName = name;
            while (ts.isQualifiedName(rootName)) rootName = rootName.left;
            const imported = ts.isIdentifier(rootName) ? imports.get(rootName.text) : undefined;
            let symbol = checker.getSymbolAtLocation(name);
            if (symbol && symbol.flags & ts.SymbolFlags.Alias)
              symbol = checker.getAliasedSymbol(symbol);
            dto =
              !imported?.typeOnly &&
              !!symbol?.declarations?.some(
                (d) => ts.isClassDeclaration(d) && d.name?.text.endsWith('Dto'),
              );
          }
          if (!dto)
            fail(
              'request-dto',
              `Whole-object @${binding.name}() must use a runtime DTO class, not Record/interface/any/type-only import.`,
              param,
            );
        }
      }
    }
    const visitUnsafe = (node) => {
      const unsafeName = ts.isPropertyAccessExpression(node)
        ? node.name.text
        : ts.isElementAccessExpression(node) &&
            node.argumentExpression &&
            ts.isStringLiteralLike(node.argumentExpression)
          ? node.argumentExpression.text
          : undefined;
      if (['$queryRawUnsafe', '$executeRawUnsafe'].includes(unsafeName)) {
        report(
          node,
          'unsafe-raw-query',
          'Use typed Prisma queries or parameterized SQL; unsafe raw APIs are forbidden.',
          'raw-query',
        );
      }
      ts.forEachChild(node, visitUnsafe);
    };
    visitUnsafe(source);
  }
  for (const kind of ['publicHandlers', 'memberMutations'])
    for (const entry of routePolicy[kind])
      if (!observedPolicies[kind].has(handlerKey(entry.file, entry.symbol)))
        violations.push({
          file: entry.file,
          line: 1,
          symbol: entry.symbol,
          rule: 'stale-route-policy',
          message: `Remove or correct stale ${kind} entry; the route is missing or its classification changed.`,
        });
  const baselinePath = resolve(root, 'scripts/backend-conventions-baseline.json');
  baseline ??= existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : [];
  if (!Array.isArray(baseline)) throw Error('Conventions baseline must be an explicit array.');
  const id = (item) => JSON.stringify([item.file, item.rule, item.symbol, item.fingerprint]);
  if (baseline.some((item) => !/^[a-f0-9]{64}$/.test(item.fingerprint ?? '') || !item.reason)) {
    throw Error('Baseline entries need an exact handler fingerprint and review reason.');
  }
  if (baseline.some((item) => !['response-contract', 'request-dto'].includes(item.rule))) {
    throw Error(
      'Only the reviewed legacy response-contract/request-dto debt may be baselined; security and naming gates cannot be exempted.',
    );
  }
  const allowed = new Set(baseline.map(id));
  if (allowed.size !== baseline.length) throw Error('Duplicate conventions baseline entry.');
  const found = new Set(violations.map(id));
  return {
    files: files.length,
    violations: violations.filter((item) => !allowed.has(id(item))),
    legacy: violations.filter((item) => allowed.has(id(item))),
    staleBaseline: baseline.filter((item) => !found.has(id(item))),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkBackendConventions();
    for (const issue of [
      ...result.violations,
      ...(process.argv.includes('--report-legacy') ? result.legacy : []),
    ]) {
      console.error(
        `${issue.file}:${issue.line} [${issue.rule}] ${issue.symbol}: ${issue.message}`,
      );
    }
    for (const item of result.staleBaseline)
      console.error(`Remove stale baseline: ${item.file} ${item.symbol} [${item.rule}]`);
    if (result.violations.length || result.staleBaseline.length) process.exitCode = 1;
    else
      console.log(
        `Backend conventions passed (${result.files} files; ${result.legacy.length} frozen legacy deviations).`,
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
