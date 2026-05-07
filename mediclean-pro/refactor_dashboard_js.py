
import os

file_path = r"d:/mediclean-pro-v3/server/website_public/admin_dashboard.html"
js_out_path = r"d:/mediclean-pro-v3/server/website_public/js/admin_dashboard.js"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1-based line numbers to 0-based indices
# Block 1 Content: 1317 to 3162
# Block 1 Tag Start: 1316 (<script>)
# Block 1 Tag End: 3163 (</script>)
idx_b1_start = 1316 - 1
idx_b1_content_start = 1317 - 1
idx_b1_content_end = 3162 - 1
idx_b1_end = 3163 - 1

# Block 2 Content: 3220 to 4137
# Block 2 Tag Start: 3219 (<script>)
# Block 2 Tag End: 4138 (</script>)
idx_b2_start = 3219 - 1
idx_b2_content_start = 3220 - 1
idx_b2_content_end = 4137 - 1
idx_b2_end = 4138 - 1

# Extract JS content
js_content = []
js_content.extend(lines[idx_b1_content_start : idx_b1_content_end + 1])
js_content.append('\n// --- PART 2 ---\n')
js_content.extend(lines[idx_b2_content_start : idx_b2_content_end + 1])

with open(js_out_path, 'w', encoding='utf-8') as f:
    f.writelines(js_content)

print(f"Created {js_out_path} with {len(js_content)} lines.")

# Construct new HTML
new_html = []
new_html.extend(lines[0 : idx_b1_start]) # Keep up to 1315
new_html.append('    <script src="js/admin_dashboard.js"></script>\n')
new_html.extend(lines[idx_b1_end + 1 : idx_b2_start]) # Keep 3164 to 3218 (Modal)
# Skip Block 2 tags and content
new_html.extend(lines[idx_b2_end + 1 :]) # Keep 4139 to end

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_html)

print(f"Updated {file_path}. Original lines: {len(lines)}, New lines: {len(new_html)}")
