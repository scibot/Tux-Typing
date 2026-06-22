const WORD_LISTS = {
  easy: [
    'cat','dog','sun','run','fun','big','red','cup','hat','hot',
    'sit','fig','log','map','nap','pen','pot','rag','tap','van',
    'ant','bat','can','dad','egg','fan','gap','hop','ink','jar',
    'kit','lip','mom','net','oak','paw','rib','sad','tan','urn',
    'web','yak','zip','arm','bed','cob','den','elm','fit','gel',
    'hem','ice','joy','key','leg','mud','nun','odd','pop','raw',
    'sea','top','use','vim','win','fox','box','mix','fix','six',
    'fly','try','cry','dry','sky','spy','shy','buy','guy','lay',
  ],
  medium: [
    'apple','brave','chess','dance','earth','flame','grape','heart',
    'image','joker','knife','lemon','magic','night','ocean','peace',
    'quiet','river','storm','tiger','umbra','voice','world','xenon',
    'yacht','zebra','angel','blast','candy','drift','elder','frost',
    'giant','honey','irony','jewel','kites','light','mouse','north',
    'ozone','power','queen','radio','snake','tower','ultra','valor',
    'witch','xerox','years','zones','alarm','blend','clown','depot',
    'eagle','fever','globe','haven','inlet','japan','karma','lance',
    'maple','nerve','orbit','panel','quill','reign','sword','token',
    'urged','venus','water','extra','young','zoned','actor','bonus',
    'cross','drive','every','force','grant','hotel','index','joint',
    'knock','lunar','mercy','novel','other','plaza','quest','round',
    'scale','throw','under','vivid','waste','xeric','yield','zippy',
  ],
  hard: [
    'abruptly','backfire','cachexia','darkness','eloquent',
    'fragment','graphics','headline','icefield','jealousy',
    'keyboard','lifestyle','magnetic','nitrogen','overcome',
    'portrait','quandary','rightful','snowball','thankful',
    'universe','Variable','wandered','xylophone','yearbook',
    'zeppelin','absolute','brackets','calamity','dextrous',
    'embezzle','flywheel','graphics','hexadecimal','inventor',
    'jubilant','kindness','labyrinth','mechanism','nocturnal',
    'obsolete','paradigm','quantity','rhetoric','supernova',
    'thousand','umbrella','vigilant','workshop','xanthous',
    'yielding','zeitgeist','alphabet','borrowed','concepts',
    'diagonal','eloquent','fountain','generate','homework',
    'interval','junction','knapsack','language','multiply',
    'notebook','optimize','packages','quantity','research',
    'software','template','uniquely','viewport','whatever',
  ],
};

// ── Secret Level Word Lists ────────────────────────────────────────────────
const SECRET_WORD_LISTS = {
  funny: [
    'butt','butts','boob','boobs','balls','fart','farts','farted',
    'poop','poopy','poop','toot','toots','burp','burps','burped',
    'buns','bum','bummy','dork','dorks','dooky','dookie','stinky',
    'sticky','booger','boogers','wiener','wienie','undies','wedgie',
    'wedgies','dingus','dingbat','nutty','goofy','wacky','loony',
    'bonkers','chunky','bumpy','lumpy','dumpy','frumpy','grumpy',
    'rumpus','tushie','hiney','honker','snorkel','doofus','goober',
    'noogie','hooey','baloney','phooey','weirdo','noodly','wobbly',
    'jiggly','wiggly','squiggly','giggly','bubbly','wobbly','flabby',
    'slobber','drool','drooler','tooter','tooting','pooting','pooted',
    'dingdong','numbskull','klutz','klutzy','dweeb','dweebs','spazzy',
  ],
};

// Secret level metadata
const SECRET_LEVELS = {
  funny: {
    name: 'Funny Words',
    icon: '🤣',
    code: 'stinky socks',
    description: 'Silly words only!',
    wordList: 'funny',
    speed: 0.9,
    spawnRate: 3200,
    maxWords: 5,
    lives: 5,
  },
};

// flatten all words for practice
const ALL_WORDS = [...new Set([
  ...WORD_LISTS.easy,
  ...WORD_LISTS.medium,
  ...WORD_LISTS.hard,
])];
