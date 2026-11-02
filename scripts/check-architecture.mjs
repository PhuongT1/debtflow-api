import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
    ['**/generated/**', '**/*.spec.ts', '**/*.d.ts'],
  );
  const violations = [];

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
      if (businessService && target.endsWith('.controller.ts')) {
        report(literal, 'service-controller-dependency', 'Services must not import controllers.');
      }
      if (
        ['src/common', 'src/config', 'src/database', 'src/auth'].some((dir) => inside(owner, dir)) &&
        (inside(target, 'src/modules') || (!inside(owner, 'src/auth') && inside(target, 'src/auth')))
      ) {
        report(
          literal,
          'infrastructure-dependency',
          `Infrastructure must not import feature/auth code (${literal.text}).`,
        );
      }
      if (
        owner.endsWith('.controller.ts') &&
        (inside(target, 'src/database') ||
          /(?:^|\/)generated\/prisma\/[^/]*client(?:\.d)?\.ts$/.test(target))
      ) {
        report(
          literal,
          'controller-persistence',
          `Delegate database access to a service (${literal.text}).`,
        );
      }
      // @generated/prisma also exports enums/types, which controllers may legitimately use.
      // Constructing or importing a client through that barrel is a separate persistence violation.
      if (
        owner.endsWith('.controller.ts') &&
        inside(target, 'src/generated/prisma') &&
        literal.parent &&
        ts.isImportDeclaration(literal.parent)
      ) {
        const bindings = literal.parent.importClause?.namedBindings;
        if (
          bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.some((item) => (item.propertyName ?? item.name).text === 'PrismaClient')
        )
          report(literal, 'controller-persistence', 'Controllers must not import PrismaClient.');
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
