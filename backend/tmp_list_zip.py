import zipfile, json, sys
zip_path = r'C:\\Users\\hp\\OneDrive\\Documents\\Desktop\\AgriSphere-AI\\AgriSphere_Trained_Intent_Model_PORTABLE_20261111_172637_799172_UTC.zip'
with zipfile.ZipFile(zip_path, 'r') as z:
    entries = [{"name": info.filename, "size": info.file_size} for info in z.infolist()]
print(json.dumps(entries, indent=2))

