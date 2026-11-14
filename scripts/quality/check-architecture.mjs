import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const portable = (value) => value.replaceAll('\\', '/');
const inside = (path, directory) => path === directory || path.startsWith(`${directory}/`);

/** Resolve literal imports rather than matching text, so aliases and relative paths behave alike. */
export function checkArchitecture(root = projectRoot) {
  root = resolve(root);
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath || dirname(configPath) !== root)
    throw Error('Expected tsconfig.json in project root.');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  if (parsed.errors.length) {
    throw Error(
      parsed.errors
        .map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
        .join('\n'),
    );
  }
  const cache = ts.createModuleResolutionCache(root, (name) => name, parsed.options);
  const files = ts.sys.readDirectory(
    resolve(root, 'src'),
    ['.ts'],
    ['**/generated/**', '**/*.spec.ts', '**/_test/**', '**/*.d.ts'],
  );
  const violations = [];
  const specs = ts.sys.readDirectory(
    resolve(root, 'src'),
    ['.ts'],
    ['**/generated/**'],
    ['**/*.spec.ts'],
  );
  for (const file of specs) {
    const owner = portable(relative(root, file));
    const parts = owner.split('/');
    const expected = owner.startsWith('src/modules/')
      ? `src/modules/${parts[2]}/_test/`
      : undefined;
    if (expected ? !owner.startsWith(expected) : !parts.slice(0, -1).includes('_test'))
      violations.push({
        file: owner,
        line: 1,
        rule: 'test-layout',
        message: `Keep tests in the owning _test folder${expected ? ` (${expected})` : ''}.`,
      });
  }

  // Check each inner layer transitively, including type-only imports through shared helpers.
  const partyRoot = 'src/modules/parties';
  const domainRoot = `${partyRoot}/domain`;
  const applicationRoot = `${partyRoot}/application`;
  const checkedCore = new Set();
  const checkCore = (file, layer) => {
    const key = `${layer}:${file}`;
    if (checkedCore.has(key) || !ts.sys.fileExists(file)) return;
    checkedCore.add(key);
    const owner = portable(relative(root, file));
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const inspectCore = (literal) => {
      const imported = ts.resolveModuleName(
        literal.text,
        file,
        parsed.options,
        ts.sys,
        cache,
      ).resolvedModule;
      const target = imported ? portable(relative(root, imported.resolvedFileName)) : '';
      const featureTarget = inside(target, 'src/modules');
      const allowedFeature =
        inside(target, domainRoot) || (layer === 'application' && inside(target, applicationRoot));
      const forbidden =
        /^(?:@nestjs(?:\/|$)|@prisma(?:\/|$)|express(?:\/|$)|pg$|node:)/.test(literal.text) ||
        ['src/generated', 'src/database', 'src/config', 'src/auth'].some((dir) =>
          inside(target, dir),
        ) ||
        /\/(?:dto|infrastructure|presentation|_test)\//.test(target) ||
        /\.(?:controller|module)\.ts$/.test(target) ||
        (featureTarget && !allowedFeature) ||
        (imported && !inside(target, 'src') && !inside(target, 'node_modules/typescript/lib'));
      if (forbidden) {
        violations.push({
          file: owner,
          line: source.getLineAndCharacterOfPosition(literal.getStart(source)).line + 1,
          rule: 'party-clean-core',
          message: `Party ${layer} must depend only on its inner layers and neutral shared code (${literal.text}).`,
        });
      } else if (inside(target, 'src')) checkCore(imported.resolvedFileName, layer);
    };
    const visit = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      )
        inspectCore(node.moduleSpecifier);
      if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteralLike(node.argument.literal)
      )
        inspectCore(node.argument.literal);
      if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        ts.isStringLiteralLike(node.moduleReference.expression)
      )
        inspectCore(node.moduleReference.expression);
      if (
        ts.isCallExpression(node) &&
        node.arguments.length === 1 &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
        ts.isStringLiteralLike(node.arguments[0])
      )
        inspectCore(node.arguments[0]);
      ts.forEachChild(node, visit);
    };
    visit(source);
  };
  for (const file of files) {
    const owner = portable(relative(root, file));
    if (inside(owner, domainRoot)) checkCore(file, 'domain');
    if (inside(owner, applicationRoot)) checkCore(file, 'application');
  }

  for (const file of files) {
    const owner = portable(relative(root, file));
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const report = (node, rule, message) =>
      violations.push({
        file: owner,
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        rule,
        message,
      });
    if (['src/modules/public', 'src/modules/protected'].some((dir) => inside(owner, dir)))
      report(
        source,
        'domain-layout',
        'Own features under src/modules/<domain>; declare access at the route boundary.',
      );
    const partyLayer = inside(owner, partyRoot)
      ? owner.slice(partyRoot.length + 1).split('/')[0]
      : undefined;
    if (
      partyLayer &&
      !['domain', 'application', 'presentation', 'infrastructure', '_test'].includes(partyLayer) &&
      ![`${partyRoot}/parties.module.ts`, `${partyRoot}/party.list-query.ts`].includes(owner)
    )
      report(
        source,
        'party-layer-placement',
        'Put Party code in its owning clean layer; only Nest composition and shared outer list capabilities stay at the feature root.',
      );
    const inspect = (literal) => {
      const businessService =
        owner.endsWith('.service.ts') &&
        (inside(owner, 'src/modules') || inside(owner, 'src/auth'));
      if (
        businessService &&
        ['@nestjs/swagger', 'express', 'express-serve-static-core'].includes(literal.text)
      ) {
        report(
          literal,
          'service-http-dependency',
          'Services must not depend on Swagger or Express transport objects.',
        );
      }
      const imported = ts.resolveModuleName(
        literal.text,
        file,
        parsed.options,
        ts.sys,
        cache,
      ).resolvedModule;
      if (!imported) return; // The TypeScript build reports unresolved modules.
      const target = portable(relative(root, imported.resolvedFileName));
      if (
        inside(owner, `${partyRoot}/infrastructure`) &&
        inside(target, `${partyRoot}/presentation`)
      )
        report(
          literal,
          'party-adapter-dependency',
          'Database/event adapters must not depend on HTTP presentation.',
        );
      if (
        inside(owner, `${partyRoot}/presentation`) &&
        inside(target, `${partyRoot}/infrastructure`)
      )
        report(
          literal,
          'party-adapter-dependency',
          'HTTP presentation calls application contracts, not concrete persistence adapters.',
        );
      if (target.split('/').includes('_test'))
        report(literal, 'test-dependency', 'Production code must not import test-only modules.');
      if (businessService && target.endsWith('.controller.ts')) {
        report(literal, 'service-controller-dependency', 'Services must not import controllers.');
      }
      if (
        ['src/common', 'src/config', 'src/database', 'src/auth'].some((dir) =>
          inside(owner, dir),
        ) &&
        (inside(target, 'src/modules') ||
          (!inside(owner, 'src/auth') && inside(target, 'src/auth')))
      ) {
        report(
          literal,
          'infrastructure-dependency',
          `Infrastructure must not import feature/auth code (${literal.text}).`,
        );
      }
      const featureCode = inside(owner, 'src/modules');
      const composition = owner.endsWith('.module.ts');
      const adapter = owner.split('/').includes('infrastructure');
      const port = owner.split('/').includes('repositories');
      if (
        featureCode &&
        !adapter &&
        !owner.endsWith('.controller.ts') &&
        inside(target, 'src/database')
      )
        report(
          literal,
          'persistence-adapter',
          'Only feature infrastructure adapters may access the database layer.',
        );
      if (featureCode && !adapter && !composition && target.split('/').includes('infrastructure'))
        report(
          literal,
          'implementation-dependency',
          'Consume the repository contract; only module composition binds an infrastructure implementation.',
        );
      if (port && inside(target, 'src/generated/prisma'))
        report(
          literal,
          'repository-contract',
          'Keep generated persistence types in the owning types/projection file; repository ports expose named use-case data.',
        );
      if (owner.endsWith('.controller.ts') && inside(target, 'src/database')) {
        report(
          literal,
          'controller-persistence',
          `Delegate database access to a service (${literal.text}).`,
        );
      }
      // Generated modules also export enums/types. Named imports of those remain legal;
      // whole client modules and aliased constructors must not bypass controller ownership.
      if (
        (owner.endsWith('.controller.ts') || (featureCode && !adapter)) &&
        inside(target, 'src/generated/prisma')
      ) {
        const declaration = literal.parent;
        const bindings = ts.isImportDeclaration(declaration)
          ? declaration.importClause?.namedBindings
          : undefined;
        const importsClient =
          bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.some(
            (item) => (item.propertyName ?? item.name).text === 'PrismaClient',
          );
        const wholeClient =
          /(?:client|index)(?:\.d)?\.ts$/.test(target) &&
          ((bindings && ts.isNamespaceImport(bindings)) || ts.isCallExpression(declaration));
        if (importsClient || wholeClient)
          report(
            literal,
            owner.endsWith('.controller.ts') ? 'controller-persistence' : 'persistence-adapter',
            'Only infrastructure adapters may import PrismaClient.',
          );
      }
    };
    const visit = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      )
        inspect(node.moduleSpecifier);
      if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        ts.isStringLiteralLike(node.moduleReference.expression)
      ) {
        inspect(node.moduleReference.expression);
      }
      if (
        ts.isCallExpression(node) &&
        node.arguments.length === 1 &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
        ts.isStringLiteralLike(node.arguments[0])
      )
        inspect(node.arguments[0]);
      if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteralLike(node.argument.literal)
      )
        inspect(node.argument.literal);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { files: files.length, violations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkArchitecture();
    for (const issue of result.violations) {
      console.error(`${issue.file}:${issue.line} [${issue.rule}] ${issue.message}`);
    }
    if (result.violations.length) process.exitCode = 1;
    else console.log(`Architecture checks passed (${result.files} source files).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
