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
    ['**/generated/**', '**/*.spec.ts', '**/*.d.ts'],
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
        [/\.list-query\.ts$|\.select\.ts$/, ['queries']],
        [/\.rules\.ts$/, ['rules']],
        [/\.types\.ts$/, ['types']],
        [/\.mapper\.ts$/, ['mappers']],
        [/\.dto\.ts$/, ['dto']],
      ];
      const role = roles.find(([pattern]) => pattern.test(path));
      if (role && !role[1].some((folder) => folders.includes(folder)))
        report(
          source,
          'responsibility-folder',
          `Place this feature responsibility in ${role[1].join(' or ')}/.`,
        );
      if (!folders.length && !path.endsWith('.module.ts') && !role)
        report(
          source,
          'feature-root',
          'Keep composition at the feature root; group helpers in a named responsibility folder.',
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
        !targetPath.endsWith('.module.ts')
      )
        report(
          statement,
          'feature-public-contract',
          'Cross-feature imports/re-exports must use the owning feature public/ contracts or Nest module; do not reach into private implementation folders.',
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
