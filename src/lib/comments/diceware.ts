import type { AstroCookies } from "astro";

// EFF Short Wordlist (1296 words) - subset for brevity, using common memorable words
const WORDLIST = [
  "acid", "acorn", "acre", "acts", "afar", "aged", "agent", "ajar", "alarm", "album",
  "alert", "alien", "alike", "alive", "alley", "allot", "allow", "alloy", "aloft", "alone",
  "amaze", "amber", "amend", "ample", "angel", "angle", "angry", "ankle", "apart", "apple",
  "April", "apron", "arena", "argue", "arise", "armor", "army", "aroma", "array", "arrow",
  "arson", "artsy", "ascot", "asset", "atlas", "atom", "attic", "audio", "avert", "avoid",
  "awake", "award", "awash", "azure", "bacon", "badge", "badly", "bagel", "baggy", "baker",
  "balmy", "banjo", "barge", "baron", "basic", "basin", "batch", "bath", "baton", "beast",
  "began", "begin", "begun", "being", "belly", "below", "bench", "berry", "bike", "bird",
  "birth", "black", "blade", "blame", "blank", "blast", "blaze", "bleak", "blend", "bless",
  "blimp", "blind", "blink", "bliss", "blitz", "block", "blond", "blood", "bloom", "blown",
  "bluer", "bluff", "blunt", "blurb", "blurt", "blush", "board", "boast", "boat", "bogey",
  "bold", "bolt", "bonus", "booby", "boost", "booth", "booty", "booze", "bore", "born",
  "boss", "botch", "both", "bough", "bound", "bowed", "boxer", "brace", "braid", "brain",
  "brake", "brand", "brash", "brass", "brave", "bread", "break", "bred", "breed", "brew",
  "brick", "bride", "brief", "bring", "brink", "brisk", "broad", "broil", "broke", "brook",
  "broom", "broth", "brown", "brunt", "brush", "brute", "buck", "buddy", "budge", "buggy",
  "build", "built", "bulge", "bulk", "bully", "bunch", "bunny", "burst", "cabin", "cable",
  "cache", "cadet", "cage", "cake", "calm", "camel", "cameo", "canal", "candy", "canon",
  "cape", "caper", "card", "cargo", "carol", "carry", "carve", "case", "cash", "cast",
  "catch", "cause", "cave", "cease", "cedar", "chain", "chair", "chalk", "champ", "chant",
  "chaos", "charm", "chart", "chase", "cheap", "cheat", "check", "cheek", "cheer", "chess",
  "chest", "chick", "chief", "child", "chill", "chimp", "china", "chip", "choir", "chord",
  "chore", "chose", "chunk", "churn", "cider", "cigar", "cinch", "circle", "cite", "city",
  "civic", "civil", "clad", "claim", "clamp", "clang", "clap", "clash", "clasp", "class",
  "claw", "clay", "clean", "clear", "clerk", "click", "cliff", "climb", "cling", "cloak",
  "clock", "clone", "close", "cloth", "cloud", "clout", "clown", "club", "cluck", "clue",
  "clump", "clung", "coach", "coast", "coat", "cobra", "cocoa", "coil", "coin", "cola",
  "cold", "colon", "color", "comet", "comic", "comma", "conch", "condo", "cone", "coral",
  "cord", "core", "cork", "corn", "couch", "cough", "could", "count", "coup", "court",
  "cover", "cozy", "crack", "craft", "cramp", "crane", "crank", "crash", "crate", "crave",
  "crawl", "crazy", "creak", "cream", "creek", "creep", "creme", "crepe", "crest", "crick",
  "cried", "crisp", "croak", "crock", "crook", "crop", "cross", "crowd", "crown", "crude",
  "cruel", "crush", "crust", "cubic", "cupid", "curly", "curry", "curse", "curve", "cyber",
  "cycle", "daily", "dairy", "daisy", "dance", "dandy", "darts", "dash", "data", "date",
  "dawn", "dealt", "dear", "death", "debut", "decal", "decay", "decor", "decoy", "decry",
  "deed", "delay", "delta", "deluxe", "demon", "denim", "dense", "depot", "depth", "derby",
  "desk", "diary", "dice", "diner", "dingy", "disco", "ditch", "diver", "dizzy", "dodge",
  "doing", "doll", "donor", "donut", "doom", "door", "dorm", "doubt", "dough", "dove",
  "dozen", "draft", "drain", "drake", "drama", "drank", "drape", "draw", "dread", "dream",
  "dress", "dried", "drift", "drill", "drink", "drive", "drone", "drool", "droop", "drown",
  "drum", "drunk", "dryer", "dryly", "duck", "dude", "dug", "duke", "dummy", "dune",
  "dusty", "dwarf", "dwell", "eager", "eagle", "earth", "easel", "east", "eaten", "eater",
  "ebony", "echo", "edge", "eerie", "eight", "elbow", "elder", "elect", "elite", "elope",
  "elude", "email", "ember", "emit", "empty", "ended", "enemy", "enjoy", "enter", "entry",
  "envoy", "epoch", "equal", "equip", "erase", "error", "erupt", "essay", "etch", "evade",
  "event", "every", "evict", "exact", "exalt", "excel", "exert", "exile", "exist", "expel",
  "extra", "eyed", "fable", "facet", "fact", "faint", "fairy", "faith", "false", "fame",
  "fancy", "fang", "far", "farce", "farm", "fatal", "fate", "fatty", "fault", "fauna",
  "favor", "feast", "feat", "fence", "fend", "ferry", "fetal", "fetch", "fever", "fiber",
  "fifth", "fifty", "fight", "filmy", "final", "finch", "find", "fine", "fire", "firm",
  "first", "fish", "fist", "five", "fixed", "flair", "flak", "flame", "flank", "flap",
  "flare", "flash", "flask", "flat", "flaw", "flax", "flea", "fled", "flesh", "flex",
  "flick", "fling", "flint", "flip", "flit", "float", "flock", "flood", "floor", "flop",
  "flora", "floss", "flour", "flown", "fluff", "fluid", "flung", "flunk", "flush", "flute",
  "foam", "focal", "focus", "foggy", "foil", "folk", "font", "food", "fool", "foot",
  "force", "forge", "forgo", "fork", "form", "forth", "forty", "forum", "fossil", "foster",
  "foul", "found", "four", "fox", "foyer", "frail", "frame", "frank", "fraud", "freak",
  "fresh", "friar", "fried", "frill", "frisk", "fritz", "frock", "frog", "from", "front",
  "frost", "froth", "frown", "froze", "fruit", "fudge", "fuel", "fully", "fumed", "fund",
  "fungi", "funky", "funny", "furry", "fuse", "fussy", "futon", "fuzzy", "gaily", "gain",
  "gala", "game", "gamma", "gamer", "gap", "gas", "gave", "gavel", "gaze", "gear",
  "gecko", "geek", "gem", "gene", "genie", "genre", "ghost", "giant", "gift", "gills",
  "given", "giver", "glad", "gland", "glare", "glass", "glaze", "gleam", "glide", "glint",
  "globe", "gloom", "glory", "gloss", "glove", "glow", "glue", "goal", "goat", "going",
  "gold", "golf", "gong", "good", "gooey", "goofy", "goose", "gorge", "gory", "gown",
  "grab", "grace", "grade", "grain", "grand", "grant", "grape", "graph", "grasp", "grass",
  "grave", "gravy", "gray", "graze", "great", "greed", "green", "greet", "grey", "grid",
  "grief", "grill", "grim", "grime", "grind", "grip", "grit", "groan", "groom", "grope",
  "gross", "group", "grove", "growl", "grown", "grub", "grunt", "guard", "guava", "guess",
  "guest", "guide", "guild", "guilt", "guise", "gulf", "gummy", "guru", "gusto", "gusty",
  "habit", "half", "halo", "halt", "happy", "hardy", "harm", "harsh", "haste", "hasty",
  "hatch", "hate", "haunt", "haven", "havoc", "hawk", "hazel", "hazy", "head", "heady",
  "heard", "heart", "heat", "heavy", "hedge", "hefty", "heist", "hello", "hence", "herb",
  "herd", "hero", "heron", "hex", "hick", "hide", "high", "hiker", "hill", "hilly",
  "hinge", "hippo", "hippy", "hitch", "hoard", "hobby", "hoist", "hold", "holly", "homer",
  "honey", "honor", "hoof", "hook", "hoop", "hope", "horn", "horse", "host", "hotel",
  "hound", "house", "hover", "howl", "hub", "hug", "hull", "human", "humid", "humor",
  "hump", "humus", "hunch", "hung", "hunk", "hunt", "hurry", "hurt", "hush", "husky",
  "hydro", "hyena", "hymn", "icing", "icon", "ideal", "idiom", "idiot", "idle", "idly",
  "igloo", "image", "impel", "inch", "index", "inner", "input", "intro", "ionic", "irate",
  "iris", "irish", "irony", "issue", "ivory", "ivy", "jabot", "jack", "jaded", "jaunt",
  "jazzy", "jeans", "jeep", "jelly", "jerky", "jest", "jewel", "jiffy", "jilt", "jimmy",
  "jive", "job", "jock", "join", "joint", "joker", "jolly", "jolt", "jolty", "joust",
  "joy", "judge", "juice", "juicy", "jumbo", "jump", "jumpy", "junco", "June", "jungle",
  "junk", "juror", "jury", "karma", "kayak", "keen", "keep", "keg", "kelp", "kept",
  "kick", "kiddo", "kilt", "kind", "king", "kiosk", "kite", "kitty", "kiwi", "knee",
  "kneel", "knelt", "knife", "knit", "knob", "knock", "knot", "known", "koala", "krill",
  "label", "labor", "lace", "lack", "lacy", "laden", "ladle", "lady", "lair", "lake",
  "lance", "land", "lane", "lapel", "lapse", "large", "larva", "laser", "lasso", "latch",
  "later", "latex", "lathe", "latte", "laugh", "lava", "lawn", "layer", "lazy", "leach",
  "lead", "leaf", "leafy", "lean", "leap", "learn", "lease", "leash", "least", "leave",
  "ledge", "leech", "left", "legal", "lemon", "lend", "lens", "leper", "less", "level",
  "lever", "light", "like", "lilac", "lily", "limb", "limbo", "lime", "limit", "limp",
  "line", "linen", "liner", "lingo", "link", "lion", "lipid", "list", "liter", "lithe",
  "liver", "livid", "llama", "load", "loaf", "loan", "lobby", "local", "locus", "lodge",
  "loft", "lofty", "logic", "logo", "lone", "long", "look", "loom", "loop", "loose",
  "loot", "lord", "lorry", "loser", "loss", "lost", "lotus", "loud", "louse", "lousy",
  "love", "lover", "lower", "lowly", "loyal", "luck", "lucky", "lump", "lumpy", "lunar",
  "lunch", "lunge", "lurch", "lure", "lurid", "lurk", "lush", "lying", "lyric", "macho",
  "macro", "madam", "made", "magic", "magma", "maid", "main", "major", "maker", "malt",
  "mama", "mamba", "mambo", "mango", "mania", "manic", "manor", "maple", "march", "mare",
  "mark", "marry", "marsh", "mash", "mason", "mass", "mast", "match", "mate", "math",
  "matte", "mauve", "mayor", "maze", "meal", "mean", "meaty", "medal", "media", "medic",
  "meek", "mega", "melon", "memo", "mend", "menu", "mercy", "merge", "merit", "merry",
  "mesh", "messy", "met", "metal", "meter", "metro", "micro", "mild", "mile", "milk",
  "milky", "mill", "mimic", "mince", "mind", "miner", "mini", "minor", "mint", "minus",
  "mirth", "misty", "mite", "mitre", "mix", "moat", "mock", "mode", "model", "modem",
  "moist", "molar", "mold", "moldy", "mole", "money", "month", "mooch", "mood", "moody",
  "moon", "moose", "mop", "moral", "morph", "morse", "moss", "mossy", "motel", "moth",
  "motor", "motto", "mould", "mound", "mount", "mourn", "mouse", "mousy", "mouth", "move",
  "movie", "mower", "much", "muck", "mucus", "muddy", "mug", "muggy", "mulch", "mule",
  "mummy", "munch", "mung", "mural", "murky", "muse", "mush", "mushy", "music", "musk",
  "musky", "must", "musty", "mute", "nacho", "nag", "nail", "naive", "name", "nanny",
  "nap", "happy", "nasal", "nasty", "natal", "naval", "navel", "navy", "near", "neat",
  "neck", "need", "needy", "neon", "nerdy", "nerve", "nest", "never", "new", "newly",
  "news", "newt", "next", "nicer", "niche", "nick", "niece", "night", "nil", "nimble",
  "nine", "ninja", "ninth", "noble", "nod", "node", "noise", "noisy", "none", "nook",
  "noon", "north", "nose", "nosy", "notch", "note", "noun", "novel", "nudge", "null",
  "numb", "nurse", "nutty", "nylon", "oaken", "oat", "oath", "obese", "occur", "ocean",
  "octet", "odds", "odor", "offer", "often", "oily", "okapi", "okay", "olive", "omega",
  "omen", "omit", "once", "onion", "onset", "ooze", "opal", "open", "opera", "optic",
  "orbit", "orchid", "order", "organ", "other", "otter", "ouch", "ounce", "outer", "outdo",
  "outer", "oval", "oven", "over", "owing", "owner", "oxide", "oxygen", "oyster", "ozone"
];

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function generateAlias(): string {
  const array = new Uint32Array(2);
  crypto.getRandomValues(array);

  const word1 = WORDLIST[array[0] % WORDLIST.length];
  const word2 = WORDLIST[array[1] % WORDLIST.length];

  return `${toTitleCase(word1)} ${toTitleCase(word2)}`;
}

const COOKIE_NAME = "comment_alias";
const COOKIE_MAX_AGE = 34560000; // ~400 days

export function getOrCreateAlias(cookies: AstroCookies): string {
  const existing = cookies.get(COOKIE_NAME)?.value;

  if (existing) {
    return decodeURIComponent(existing);
  }

  const newAlias = generateAlias();

  cookies.set(COOKIE_NAME, newAlias, {
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
    secure: import.meta.env.PROD,
    httpOnly: true,
  });

  return newAlias;
}

export function getAliasFromCookie(cookies: AstroCookies): string | null {
  const existing = cookies.get(COOKIE_NAME)?.value;
  return existing ? decodeURIComponent(existing) : null;
}
