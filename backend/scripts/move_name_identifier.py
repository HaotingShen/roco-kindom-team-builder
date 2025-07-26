import re

with open(r"D:\Alan\Github Projects\wiki.biligame.com\rocom\奇丽花.html", "r", encoding="utf-8") as f:
    html = f.read()

# Find all occurrences matching the exact class
pattern = r'<div class="rocom_sprite_skillName font-mainfeiziti">(.*?)</div>'
move_names = re.findall(pattern, html)

for name in move_names:
    print(name)