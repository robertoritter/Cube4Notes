"""Valida a estrutura mínima e referências Markdown locais de um projeto."""

from __future__ import annotations

import argparse
from pathlib import Path
import re


REQUIRED = ("README.md", "AGENTS.md", "docs/00-visao-e-escopo.md")
PLACEHOLDERS = ("[TODO", "{{", "A definir", "TBD")
LINK = re.compile(r"\[[^]]*\]\((?!https?://|mailto:|#)([^)]+)\)")


def validate(root: Path) -> list[str]:
    problems: list[str] = []
    for relative in REQUIRED:
        if not (root / relative).is_file():
            problems.append(f"arquivo obrigatório ausente: {relative}")

    for path in root.rglob("*.md"):
        if any(part in {".git", ".venv", "node_modules"} for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8")
        for marker in PLACEHOLDERS:
            if marker in text:
                problems.append(f"placeholder '{marker}' em {path.relative_to(root)}")
        for raw_target in LINK.findall(text):
            target = raw_target.split("#", 1)[0].strip().strip("<>")
            if target and not (path.parent / target).resolve().exists():
                problems.append(f"link local quebrado em {path.relative_to(root)}: {raw_target}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", nargs="?", type=Path, default=Path.cwd())
    args = parser.parse_args()
    root = args.project.resolve()
    problems = validate(root)
    if problems:
        print("Validação falhou:")
        for problem in problems:
            print(f"- {problem}")
        return 1
    print("Estrutura mínima validada com sucesso.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
