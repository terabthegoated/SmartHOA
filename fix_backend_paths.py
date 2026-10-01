from pathlib import Path

root = Path(r'C:\Users\Jorell\Downloads\SmartHOA-1\backend')
replacements = {
    "include_once '../../config/database.php';": "require_once __DIR__ . '/../../config/database.php';",
    "require_once '../../vendor/autoload.php';": "require_once __DIR__ . '/../../vendor/autoload.php';",
    'include_once "../../config/database.php";': 'require_once __DIR__ . "/../../config/database.php";',
    'require_once "../../vendor/autoload.php";': 'require_once __DIR__ . "/../../vendor/autoload.php";',
}

for path in root.rglob('*.php'):
    text = path.read_text(encoding='utf-8')
    updated = text
    for old, new in replacements.items():
        updated = updated.replace(old, new)
    if updated != text:
        path.write_text(updated, encoding='utf-8')
        print(path)
