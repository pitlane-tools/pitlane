import { readFileSync } from "node:fs";
import path from "node:path";

import { fencedBlocks, guideFiles, packageReadmes } from "./support/markdown.ts";

function scannedFiles(root: string) {
    let readmes = packageReadmes(root)
        .filter(readme => readme.published || readme.name === "pitlane")
        .map(readme => readme.path);
    return [...guideFiles(root), ...readmes].sort();
}

export function check(root: string): string[] {
    return scannedFiles(root).flatMap(file =>
        fencedBlocks(readFileSync(path.join(root, file), "utf8"))
            .filter(block => block.info === "")
            .map(
                block =>
                    `${file}:${block.line}: fenced code block declares no language; name one after the opening fence, such as \`\`\`ts or \`\`\`sh (policy.0004)`,
            ),
    );
}
