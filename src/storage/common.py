from pathlib import Path

def project_root() -> Path:

    here = Path(__file__).resolve()

    for directory in [here.parent, *here.parents]:

        if (directory / "package.json").exists():
            return directory

        if (directory / ".git").exists():
            return directory

    raise RuntimeError("Project root not found.")
