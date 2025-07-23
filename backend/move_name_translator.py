import json

def format_json_array_field(field_name, move_names, max_per_line=10, indent="  "):
    result = f'"{field_name}": [\n'
    total = len(move_names)
    for i, move in enumerate(move_names):
        # Add comma after every item except the last
        comma = ',' if i < total - 1 else ''
        # Start a new line after every max_per_line moves, or at the beginning
        if i % max_per_line == 0:
            result += indent
        result += f'"{move}"{comma}'
        # Line break after every max_per_line moves, or after the last move
        if (i + 1) % max_per_line == 0 or i == total - 1:
            result += '\n'
        else:
            result += ' '
    result += ']'
    return result

# Load moves and build Chinese->English map, and is_move_stone flag
with open(r'D:\Alan\Github Projects\roco-kindom-team-builder\backend\data\moves_with_stone_flag.json', 'r', encoding='utf-8') as f:
    moves = json.load(f)

zh2en = {}
is_move_stone_map = {}  # zh_name -> is_move_stone bool
for move in moves:
    zh = move.get('localized', {}).get('zh', {}).get('name', '').strip()
    en = move.get('name', '').strip()
    is_move_stone = move.get('is_move_stone', False)
    if zh:
        zh2en[zh] = en
        is_move_stone_map[zh] = is_move_stone

# Input: Paste the Chinese move lists for a given monster
chinese_learnable_moves = [
    "落星", "种子弹", "力量增效", "棘突", "根吸收", "防御", "许愿星", "盛开", "闪光", "氧输送",
    "星轨裂变", "叶绿光束", "寄生种子", "冲撞", "丰饶", "压扁", "二律背反", "打鼾", "放晴", "仙人掌刺击",
    "攻击场地", "闪光冲击", "富养化", "逆袭", "移花接木", "光能聚集", "光合作用"
]

chinese_legacy_moves = [
    "休息回复", "荆棘爪", "引燃", "蓄水", "虹光冲击", "泥浆铠甲", "霜降", "升龙咆哮", "麻痹", "毒孢子",
    "假寐", "化劲", "羽化加速", "柔弱", "小偷小摸", "贪婪", "啮合传递", "超维投射"
]

chinese_move_stones = [
    "扫尾", "能量刃", "当头棒喝", "后发制人", "先发制人", "能量炮", "乘胜追击", "重击", "魔能爆", "垂死反击",
    "气势一击", "快速移动", "伺机而动", "操控", "应激反应", "有效预防", "借用", "热身运动", "旋转突击", "魔法增效",
    "咆哮", "音波弹", "加固", "鼓劲", "耀眼", "三鼓作气", "晒太阳", "顶端优势", "藤鞭", "藤绞",
    "花炮", "酶浓度调整", "纤维化", "芳香诱引", "种皮爆裂", "筛管奔流", "聚盐", "光刃", "天光", "漫反射",
    "光之矛", "透射", "流沙", "刺盾", "硬化", "泥巴喷射", "落石", "震击", "石肤术", "钧势",
    "飞踢"
]


def translate_moves(zh_names):
    en_names = []
    for zh in zh_names:
        en = zh2en.get(zh)
        en_names.append(en or f"UNKNOWN({zh})")
    return en_names

learnable_moves_en = translate_moves(chinese_learnable_moves)
move_stones_en = translate_moves(chinese_move_stones)
legacy_moves_en = translate_moves(chinese_legacy_moves)

# Output in JSON-ready copy-paste format (multi-line, up to 10/line)
print('\n\n--- Copy below for your monster JSON entry ---\n')
print(format_json_array_field("learnable_moves", learnable_moves_en, max_per_line=10) + ",")
print(format_json_array_field("move_stones", move_stones_en, max_per_line=10) + ",")
print(format_json_array_field("legacy_moves", legacy_moves_en, max_per_line=10))
print('\n--- End copy ---\n')

# 1. Check all move_stones are indeed move stones
for zh in chinese_move_stones:
    if zh not in is_move_stone_map:
        print(f"WARNING: Move stone '{zh}' does not exist in the moves dataset.")
    elif not is_move_stone_map[zh]:
        print(f"WARNING: '{zh}' is in move_stones but is not marked as a move stone in the dataset.")

# 2. Check all learnable moves exist
for zh in chinese_learnable_moves:
    if zh not in zh2en:
        print(f"WARNING: Learnable move '{zh}' does not exist in the moves dataset.")

# 3. Check for duplicates between learnable_moves and move_stones (using Chinese names)
chinese_learnable_set = set(chinese_learnable_moves)
chinese_move_stones_set = set(chinese_move_stones)
dupe_chinese = chinese_learnable_set & chinese_move_stones_set
if dupe_chinese:
    msg = []
    for zh in sorted(dupe_chinese):
        en = zh2en.get(zh, f"UNKNOWN({zh})")
        msg.append(f"{zh} ({en})")
    print(f"WARNING: These moves are present in both learnable_moves and move_stones: " + "\n  ".join(msg))
