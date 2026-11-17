import os, sys, json, zipfile, hashlib, pathlib, subprocess, shlex

def safe_extract(zip_path, extract_to):
    with zipfile.ZipFile(zip_path, 'r') as zf:
        # Validate entries
        total_uncompressed = 0
        seen = set()
        for info in zf.infolist():
            name = info.filename
            # Skip directories
            if name.endswith('/'):
                continue
            # No absolute paths
            if os.path.isabs(name):
                return {'status': 'invalid', 'reason': f'Absolute path in zip entry: {name}'}
            # Prevent path traversal
            if '..' in pathlib.PurePosixPath(name).parts:
                return {'status': 'invalid', 'reason': f'Path traversal in zip entry: {name}'}
            # Duplicate detection
            if name in seen:
                return {'status': 'invalid', 'reason': f'Duplicate entry: {name}'}
            seen.add(name)
            total_uncompressed += info.file_size
        # Check free space
        drive = pathlib.Path(extract_to).anchor
        if sys.platform.startswith('win'):
            import ctypes
            _, total, free = ctypes.c_ulonglong(), ctypes.c_ulonglong(), ctypes.c_ulonglong()
            ctypes.windll.kernel32.GetDiskFreeSpaceExW(ctypes.c_wchar_p(drive), ctypes.byref(_), ctypes.byref(total), ctypes.byref(free))
            free_bytes = free.value
        else:
            stat = os.statvfs(extract_to)
            free_bytes = stat.f_bavail * stat.f_frsize
        if total_uncompressed > free_bytes:
            return {'status': 'insufficient_space', 'required': total_uncompressed, 'available': free_bytes}
        # Perform extraction safely
        for info in zf.infolist():
            name = info.filename
            if name.endswith('/'):
                continue
            dest_path = pathlib.Path(extract_to) / pathlib.Path(name)
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            # If file exists, compare size/checksum
            if dest_path.exists():
                existing_size = dest_path.stat().st_size
                if existing_size == info.file_size:
                    # compute checksum to be sure
                    existing_hash = hashlib.sha256()
                    with open(dest_path, 'rb') as f:
                        for chunk in iter(lambda: f.read(8192), b''):
                            existing_hash.update(chunk)
                    zip_hash = hashlib.sha256()
                    with zf.open(info) as f:
                        for chunk in iter(lambda: f.read(8192), b''):
                            zip_hash.update(chunk)
                    if existing_hash.hexdigest() == zip_hash.hexdigest():
                        continue  # identical, skip
                # conflict
                return {'status': 'conflict', 'path': str(dest_path)}
            # Extract file data
            with zf.open(info) as source, open(dest_path, 'wb') as target:
                while True:
                    chunk = source.read(8192)
                    if not chunk:
                        break
                    target.write(chunk)
        return {'status': 'extracted', 'total_uncompressed': total_uncompressed}

def list_package_versions(python_exe, packages):
    result = {}
    for pkg in packages:
        cmd = [python_exe, '-c', f"import importlib, sys; pkg=importlib.import_module('{pkg}'); print(pkg.__version__)" ]
        try:
            out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True).strip()
            result[pkg] = out
        except Exception as e:
            result[pkg] = f'Error: {e}'
    return result

def main():
    project_root = pathlib.Path(__file__).resolve().parents[1]
    zip_path = next(project_root.glob('AgriSphere_Trained_Intent_Model_PORTABLE*.zip'))
    extract_dir = project_root / 'model_assets' / 'intent_classifier'
    extract_dir.mkdir(parents=True, exist_ok=True)

    extraction_result = safe_extract(str(zip_path), str(extract_dir))
    # Verify required files
    required = [
        'manifest.json',
        'agriculture_intent_router.joblib',
        'encoder/config.json',
        'encoder/model.safetensors',
        'encoder/tokenizer.json'
    ]
    missing = []
    for rel in required:
        if not (extract_dir / rel).exists():
            missing.append(rel)
    # List package versions
    python_exe = os.path.join(str(project_root), '.venv2', 'Scripts', 'python.exe')
    packages = ['torch', 'sentence_transformers', 'transformers', 'sklearn', 'joblib', 'numpy']
    pkg_versions = list_package_versions(python_exe, packages)
    # Read manifest labels if present
    manifest_labels = []
    manifest_path = extract_dir / 'manifest.json'
    if manifest_path.exists():
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                manifest_labels = data.get('labels', [])
        except Exception as e:
            manifest_labels = [f'Error reading manifest: {e}']
    summary = {
        'zip_path': str(zip_path),
        'extraction_result': extraction_result,
        'missing_files': missing,
        'package_versions': pkg_versions,
        'manifest_labels': manifest_labels
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
