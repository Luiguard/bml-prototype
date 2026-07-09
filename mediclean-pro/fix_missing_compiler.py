import sys

with open("patch_vfs_compiler.py", "r", encoding="utf-8") as f:
    patch_code = f.read()

# Extract the new_client_side_convert string
# It starts with: new_client_side_convert = """async function clientSideConvert(htmlMap) {
start_marker = 'new_client_side_convert = """'
end_marker = '"""'

start_idx = patch_code.find(start_marker)
if start_idx == -1:
    print("FAILED to find new_client_side_convert in patch_vfs_compiler.py")
    sys.exit(1)
start_idx += len(start_marker)

end_idx = patch_code.find(end_marker, start_idx)
func_code = patch_code[start_idx:end_idx]

# Now insert func_code into bweb-converter/converter.html right before "function parseBWEB"
with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    html_content = f.read()

target_str = "function parseBWEB(buf){"
if target_str not in html_content:
    print("FAILED: parseBWEB not found in converter.html")
    sys.exit(1)

new_html_content = html_content.replace(target_str, func_code + "\n\n" + target_str)

with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
    f.write(new_html_content)

print("SUCCESS: Restored clientSideConvert.")
