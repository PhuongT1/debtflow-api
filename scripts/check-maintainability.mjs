import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portable = (path) => path.replaceAll('\\', '/');
function tokens(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  const result = [];
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) result.push(scanner.getTokenText());
  return result;
}

/** Structural gates plus exact helper clones; semantic reuse still requires review. */
// Contract imports may target their actual owner without a forwarding barrel.
// Only named exported DTO classes or type-only exported type/interface declarations qualify.
function isDirectContractImport(statement, targetPath, targetFile) {
  if (!ts.isImportDeclaration(statement)) return false;
  const clause = statement.importClause;
  const bindings = clause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings) || clause.name) return false;
  const dto = targetPath.includes('/dto/') && targetPath.endsWith('.dto.ts');
  const types = targetPath.endsWith('.types.ts');
  if (!dto && !types) return false;
  const source = ts.createSourceFile(
    targetFile,
    readFileSync(targetFile, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  return (
    bindings.elements.length > 0 &&
    bindings.elements.every((item) => {
      const name = (item.propertyName ?? item.name).text;
      return source.statements.some((declaration) => {
        if (
          !declaration.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
        )
          return false;
        if (declaration.name?.text !== name) return false;
        return dto
          ? name.endsWith('Dto') && ts.isClassDeclaration(declaration)
          : (clause.isTypeOnly || item.isTypeOnly) &&
              (ts.isTypeAliasDeclaration(declaration) || ts.isInterfaceDeclaration(declaration));
      });
    })
  );
}

export function checkMaintainability(root = projectRoot) {
  root = resolve(root);
  const config = ts.readConfigFile(resolve(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error) throw Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  if (parsed.errors.length)
    throw Error(
      parsed.errors
        .map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
        .join('\n'),
    );
  const files = ts.sys.readDirectory(
    resolve(root, 'src'),
    ['.ts'],
    ['**/generated/**', '**/*.spec.ts', '**/_test/**', '**/*.d.ts'],
  );
  const violations = [];
  const clones = new Map();
  const contracts = new Map();

  for (const file of files) {
    const path = portable(relative(root, file));
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const location = (node) => ({
      file: path,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    });
    const report = (node, rule, message) => violations.push({ ...location(node), rule, message });
    const feature = path.startsWith('src/modules/') ? path.split('/')[2] : undefined;
    const folders = path.split('/').slice(3, -1);
    if (feature) {
      const roles = [
        [/\.controller\.ts$/, ['controllers', 'api']],
        [/\.service\.ts$/, ['services', 'jobs', 'integrations']],
        [/\.listener\.ts$/, ['listeners']],
        [
          /\.repository\.ts$/,
          [path.split('/').at(-1).startsWith('prisma-') ? 'infrastructure' : 'repositories'],
        ],
        [/\.sql\.ts$/, ['sql']],
        [/(?:\.list-query|\.select|\.query|-query)\.ts$/, ['queries']],
        [/\.rules\.ts$/, ['rules']],
        [/\.types\.ts$/, ['types']],
        [/\.mapper\.ts$/, ['mappers']],
        [/\.dto\.ts$/, ['dto']],
      ];
      const role = roles.find(([pattern]) => pattern.test(path));
      const mandatory =
        role &&
        role[1].some((folder) => ['dto', 'repositories', 'infrastructure'].includes(folder));
      const boundaryFolders = new Set(['dto', '_test', 'public', 'repositories', 'infrastructure']);
      const featurePrefix = `src/modules/${feature}/`;
      const siblings = files
        .map((name) => portable(relative(root, name)))
        .filter((name) => name.startsWith(featurePrefix));
      const groupSize = role
        ? siblings.filter((name) => {
            const parts = name.slice(featurePrefix.length).split('/');
            return role[0].test(name) && (parts.length === 1 || role[1].includes(parts[0]));
          }).length
        : 0;
      if (
        role &&
        ((mandatory && !role[1].some((folder) => folders.includes(folder))) ||
          (!mandatory && folders.length && !role[1].some((folder) => folders.includes(folder))) ||
          (!mandatory && !folders.length && groupSize >= 2))
      )
        report(
          source,
          'responsibility-folder',
          `Use ${role[1].join(' or ')}/ for a mandatory boundary or multiple files; a single ordinary responsibility stays at the feature root.`,
        );
      if (folders.length === 1 && !boundaryFolders.has(folders[0])) {
        const directory = `${featurePrefix}${folders[0]}/`;
        if (siblings.filter((name) => name.startsWith(directory)).length === 1)
          report(
            source,
            'single-file-folder',
            'Move this single-file responsibility to the feature root; keep DTO/test/public/persistence boundaries separate.',
          );
      }
      if (!folders.length && !path.endsWith('.module.ts') && !role)
        report(
          source,
          'feature-root',
          'Use a named responsibility suffix; avoid generic types.ts, utils.ts or misc.ts at the feature root.',
        );
    }

    for (const statement of source.statements) {
      if (
        path.includes('/public/') &&
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier &&
        !statement.exportClause
      )
        report(
          statement,
          'explicit-public-contract',
          'Public contracts must use named exports; do not expose an entire implementation folder with export *.',
        );
      if (
        (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
        /\.(?:service|controller|guard)\.ts$/.test(path)
      )
        report(
          statement,
          'contract-owner',
          'Export shared contracts from types/ or the existing DTO owner, not an executable provider.',
        );

      const members = ts.isInterfaceDeclaration(statement)
        ? statement.members
        : ts.isTypeAliasDeclaration(statement) && ts.isTypeLiteralNode(statement.type)
          ? statement.type.members
          : undefined;
      if (members && members.length >= 3 && members.every(ts.isPropertySignature)) {
        const signature = members
          .map((member) =>
            tokens(member.getText(source))
              .filter((token) => token !== ';' && token !== ',')
              .join('\0'),
          )
          .sort()
          .join('\n');
        const group = contracts.get(signature) ?? [];
        group.push({ ...location(statement), name: statement.name.text });
        contracts.set(signature, group);
      }

      if (
        !feature ||
        !(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) ||
        !statement.moduleSpecifier ||
        !ts.isStringLiteralLike(statement.moduleSpecifier)
      )
        continue;
      const target = ts.resolveModuleName(
        statement.moduleSpecifier.text,
        file,
        parsed.options,
        ts.sys,
      ).resolvedModule;
      if (!target) continue;
      const targetPath = portable(relative(root, target.resolvedFileName));
      if (
        targetPath.startsWith('src/modules/') &&
        targetPath.split('/')[2] !== feature &&
        !targetPath.includes('/public/') &&
        !targetPath.endsWith('.module.ts') &&
        !isDirectContractImport(statement, targetPath, target.resolvedFileName)
      )
        report(
          statement,
          'feature-public-contract',
          'Cross-feature imports must use named DTO/type-only contracts, public/ provider contracts or the owning Nest module; private implementations remain forbidden.',
        );
      if (
        !targetPath.startsWith('src/modules/') ||
        targetPath.split('/')[2] === feature ||
        !targetPath.includes('/dto/')
      )
        continue;
      const bindings = ts.isImportDeclaration(statement)
        ? statement.importClause?.namedBindings
        : undefined;
      if (
        bindings &&
        (ts.isNamespaceImport(bindings) ||
          bindings.elements.some((item) => !(item.propertyName ?? item.name).text.endsWith('Dto')))
      )
        report(
          statement,
          'dto-helper-dependency',
          "Reuse a public DTO explicitly; move shared constants/functions out of another feature's request DTO.",
        );
    }

    const visit = (node) => {
      // Thin controllers may legitimately delegate identically; helpers/providers are the clone gate.
      if (
        !path.endsWith('.controller.ts') &&
        (ts.isMethodDeclaration(node) ||
          ts.isFunctionDeclaration(node) ||
          ts.isArrowFunction(node)) &&
        node.body &&
        ts.isBlock(node.body)
      ) {
        const body = tokens(node.body.getText(source));
        if (body.length >= 25) {
          const key = body.join('\0');
          const group = clones.get(key) ?? [];
          group.push(location(node));
          clones.set(key, group);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const group of clones.values())
    if (group.length > 1)
      for (const item of group)
        violations.push({
          ...item,
          rule: 'duplicate-helper',
          message: `Exact helper body also appears at ${group
            .filter((other) => other !== item)
            .map((other) => `${other.file}:${other.line}`)
            .join(', ')}; reuse its actual owner.`,
        });
  return {
    files: files.length,
    violations,
    contractCandidates: [...contracts.values()].filter((group) => group.length > 1),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkMaintainability();
    for (const issue of result.violations)
      console.error(`${issue.file}:${issue.line} [${issue.rule}] ${issue.message}`);
    for (const group of result.contractCandidates)
      console.warn(
        `Review equivalent contracts (not automatically interchangeable): ${group.map((item) => `${item.file}:${item.line} ${item.name}`).join(', ')}`,
      );
    if (result.violations.length) process.exitCode = 1;
    else
      console.log(
        `Maintainability checks passed (${result.files} production files; ${result.contractCandidates.length} contract groups need semantic review).`,
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
