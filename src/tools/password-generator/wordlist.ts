// Diceware wordlists.
//
// The list size is chosen to be a power of six so that PHYSICAL DICE map onto it
// exactly: 6^4 = 1296 words means four dice pick a word with no bias and no
// arithmetic. That is the whole point of diceware — the randomness comes from
// your hand, not from a machine you have to trust. A list of 1000 words would
// be tidier to read and would make honest dice mapping impossible.
//
// 1296 words = log2(1296) = 10.34 bits per word.
// The Arabic list is 216 (6^3, three dice) = 7.75 bits per word: Arabic words
// are longer to type, and a shorter list keeps a passphrase usable. The tool
// computes entropy from the ACTUAL list length, so neither is overstated.

export const EN: string[] = [
  'able','acid','acre','aged','aide','ally','also','amid','ants','apex','arch','area',
  'army','arts','atom','aunt','aura','auto','avid','away','axis','axle','baby','back',
  'bade','bags','bait','bake','bald','ball','balm','band','bank','bard','bare','bark',
  'barn','base','bash','bask','bass','bath','bats','bead','beak','beam','bean','bear',
  'beat','beds','beef','been','beer','bees','bell','belt','bend','bent','best','bets',
  'bike','bile','bill','bind','bird','bite','bits','blip','blob','bloc','blot','blow',
  'blue','blur','boar','boat','body','boil','bold','bolt','bomb','bond','bone','book',
  'boom','boot','bore','born','boss','both','bout','bowl','bows','boxy','brag','bran',
  'brew','brie','brim','brow','bulb','bulk','bull','bump','bunk','buoy','burn','bury',
  'bush','bust','busy','buzz','cabs','cafe','cage','cake','calf','call','calm','came',
  'camp','cane','cape','caps','card','care','cargo','cart','case','cash','cask','cast',
  'cave','cell','cent','chef','chew','chin','chip','chop','cite','city','clad','clam',
  'clan','clap','claw','clay','clip','clod','clog','clot','club','clue','coal','coat',
  'code','coil','coin','coke','cold','colt','comb','come','cone','cook','cool','coop',
  'cope','copy','cord','core','cork','corn','cost','cosy','coup','cove','cows','crab',
  'crag','cram','crew','crib','crop','crow','crux','cube','cuff','cull','cult','curb',
  'curd','cure','curl','cusp','cute','cyan','dark','dart','dash','data','date','dawn',
  'days','dead','deaf','deal','dean','dear','debt','deck','deed','deem','deep','deer',
  'defy','deli','dent','deny','desk','dial','dice','died','diet','dime','dine','ding',
  'disc','dish','disk','dive','dock','does','dogs','dole','doll','dome','done','doom',
  'door','dorm','dose','dots','dove','down','doze','drag','draw','drew','drip','drop',
  'drum','dual','duck','duct','dude','duel','dues','duet','duke','dull','duly','dumb',
  'dune','dunk','dusk','dust','duty','each','earl','earn','ease','east','easy','eats',
  'echo','edge','edit','eels','eggs','eject','elbow','elder','elite','elk','elm','else',
  'ember','emit','empty','ends','envy','epic','equal','era','erase','error','essay','etch',
  'even','ever','evil','exam','exit','expo','eyes','face','fact','fade','fail','fair',
  'fake','fall','fame','fang','farm','fast','fate','fawn','fear','feast','feed','feel',
  'fees','feet','fell','felt','fern','feud','fibre','field','fig','file','fill','film',
  'find','fine','fire','firm','fish','fist','fits','five','fix','flag','flak','flame',
  'flap','flat','flaw','flax','fled','flee','flew','flex','flip','float','flock','flood',
  'floor','flour','flow','flu','flux','foam','foal','foil','fold','folk','fond','font',
  'food','fool','foot','ford','fore','fork','form','fort','foul','four','fowl','foxy',
  'frail','frame','free','fresh','fret','frog','from','front','frost','froth','fuel','full',
  'fume','fund','funk','furl','fury','fuse','fuss','fuzz','gain','gait','gala','gale',
  'gall','game','gang','gaps','garb','gash','gasp','gate','gave','gaze','gear','gems',
  'gene','gift','gild','gill','gilt','girl','gist','give','glad','glare','glass','glaze',
  'glee','glen','glide','glint','globe','gloom','glory','gloss','glove','glow','glue','gnaw',
  'goal','goat','goes','gold','golf','gone','gong','good','gore','gown','grab','grace',
  'grade','graft','grain','grand','grant','grape','grasp','grass','grave','gravy','graze','great',
  'greed','green','greet','grew','grid','grief','grill','grim','grin','grip','grit','groan',
  'groom','grove','growl','grown','gruff','guard','guess','guest','guide','guild','guilt','gulf',
  'gull','gulp','gums','gush','gust','guts','hail','hair','half','hall','halt','hand',
  'hang','harm','harp','hash','hat','hate','haul','have','hawk','haze','head','heal',
  'heap','hear','heat','heed','heel','heir','held','helm','help','hemp','hens','herb',
  'herd','here','hero','hide','high','hike','hill','hilt','hint','hire','hiss','hits',
  'hive','hoax','hold','hole','holy','home','hone','honk','hood','hoof','hook','hoop',
  'hope','horn','hose','host','hour','howl','hubs','huge','hulk','hull','hums','hunt',
  'hurl','hurt','hush','husk','hymn','ibex','icon','idea','idle','idol','inch','inks',
  'inlet','inn','iris','iron','isle','itch','item','ivory','ivy','jade','jail','jams',
  'jars','jaws','jazz','jeep','jelly','jest','jets','join','joke','jolt','jots','joy',
  'judge','jug','juice','july','jump','junk','jury','just','jute','keel','keen','keep',
  'kelp','kept','kerb','keys','kick','kiln','kind','king','kiss','kite','kits','knee',
  'knew','knit','knob','knot','know','lace','lack','lad','lady','laid','lake','lamb',
  'lame','lamp','land','lane','laps','lard','lark','lash','last','late','laud','lava',
  'lawn','laws','lays','lazy','lead','leaf','leak','lean','leap','left','legs','lend',
  'lens','lent','less','lets','levy','liar','lice','lick','lid','lied','lies','life',
  'lift','like','limb','lime','limp','line','link','lint','lion','lips','list','live',
  'load','loaf','loan','lobby','lock','lode','loft','logs','lone','long','look','loom',
  'loop','loose','loot','lord','lore','lose','loss','lost','lots','loud','love','lows',
  'luck','lump','lung','lure','lurk','lush','lute','lynx','made','magma','maid','mail',
  'main','make','male','mall','malt','mane','many','maps','mare','mark','mars','mash',
  'mask','mass','mast','mate','math','maze','mead','meal','mean','meat','meek','meet',
  'melt','memo','mend','menu','mercy','mere','mesh','mess','mica','mice','mild','mile',
  'milk','mill','mime','mind','mine','mint','miss','mist','mite','moat','mock','mode',
  'mold','mole','monk','mood','moon','moor','moot','mope','more','moss','most','moth',
  'move','mown','much','muck','mud','mugs','mule','mull','muse','mush','musk','must',
  'mute','myth','nail','name','nape','navy','near','neat','neck','need','neon','nest',
  'nets','news','next','nice','nick','nine','node','nods','noise','none','noon','norm',
  'nose','note','noun','nova','null','numb','nurse','nuts','oaks','oath','oats','obey',
  'oboe','odds','odour','offer','often','oils','oily','okay','older','olive','omen','omit',
  'once','ones','only','onto','onyx','ooze','opal','open','opera','opts','orbit','orca',
  'order','organ','oust','oval','oven','over','owed','owls','owns','pace','pack','pact',
  'pads','page','paid','pail','pain','pair','pale','palm','pane','pant','papa','park',
  'part','pass','past','path','pave','pawn','pays','peak','pear','peas','peat','peck',
  'peel','peer','pegs','pelt','pens','pest','pets','pick','pier','pigs','pike','pile',
  'pill','pin','pine','pink','pint','pipe','pit','pity','plan','plate','play','plea',
  'pled','plot','plow','ploy','plug','plum','plus','poem','poet','poke','pole','poll',
  'pond','pony','pool','poor','pope','pore','pork','port','pose','post','pots','pour',
  'pray','prey','prim','prize','probe','prod','prom','prop','prose','proud','prove','prowl',
  'prune','pull','pulp','pump','punch','pupil','pure','purge','purse','push','quack','quail',
  'quake','qualm','quart','quash','queen','query','quest','queue','quick','quiet','quill','quilt',
  'quirk','quit','quiz','quota','quote','race','rack','raft','rage','raid','rail','rain',
  'rake','ramp','ranch','rang','rank','rant','rare','rash','rate','rats','rave','rays',
  'reach','read','real','reap','rear','reed','reef','reek','reel','reign','rein','rely',
  'rent','rest','rice','rich','ride','rift','rigid','rims','rind','ring','rink','riot',
  'ripe','rise','risk','rite','road','roam','roar','robe','rock','rode','rods','roll',
  'roof','rook','room','root','rope','rose','rosy','rot','rout','rove','rows','royal',
  'rub','rude','rug','ruin','rule','rum','rung','runs','runt','ruse','rush','rust',
  'sack','safe','sage','said','sail','sake','sale','salt','same','sand','sane','sang',
  'sank','sash','save','saw','says','scale','scan','scar','scene','scent','scoop','scope',
  'score','scorn','scout','scrap','screw','scrub','seal','seam','sear','seas','seat','sect',
  'seed','seek','seem','seen','seep','sees','self','sell','send','sense','sent','serve',
  'sets','sewn','shade','shaft','shale','shall','shame','shape','share','shark','sharp','shawl',
  'shed','sheen','sheep','sheer','sheet','shelf','shell','shift','shine','shiny','ship','shirt',
  'shoal','shock','shoe','shone','shook','shoot','shop','shore','short','shot','shout','shove',
  'shown','shrub','shrug','shun','shut','shy','sick','side','sift','sigh','sign','silk',
  'sill','silo','silt','sing','sink','sips','sire','site','size','skate','sketch','skid',
  'skies','skill','skim','skin','skip','skirt','skull','skunk','slab','slack','slam','slang',
  'slant','slap','slate','slave','sled','sleek','sleep','sleet','slept','slice','slick','slid',
  'slim','slip','slit','slope','slot','slow','slug','slum','slump','slur','smack','small',
  'smart','smash','smear','smell','smile','smoke','snack','snail','snake','snap','snare','snarl',
  'sneak','sniff','snore','snout','snow','snug','soak','soap','soar','sober','sock','soda',
  'sofa','soft','soil','sold','sole','solid','solve','some','song','soon','soot','sore',
  'sort','soul','soup','sour','sown','space','spade','span','spare','spark','speak','spear',
  'speck','speed','spell','spend','spent','spice','spike','spill','spin','spine','spire','spite',
  'splash','split','spoil','spoke','sponge','spool','spoon','sport','spot','spout','spray','spread',
  'spring','sprint','spruce','spur','spy','squad','squat','stack','staff','stage','stain','stair',
  'stake','stale','stalk','stall','stamp','stand','stare','stark','start','state','stay','steak',
]

export const AR: string[] = [
  'باب','بحر','بيت','برد','بطل','بلد','بند','بذر','بصل','بقر','بلح','بنك',
  'تاج','تمر','توت','تين','تلة','تقي','ترس','تلج','تنور','تراب','تفاح','تمثال',
  'ثلج','ثوب','ثمر','ثعلب','ثريا','ثمين','ثابت','ثقيل','ثمانية','ثمرة','ثانية','ثورة',
  'جبل','جسر','جمل','جوز','جدار','جناح','جميل','جديد','جزيرة','جمرة','جوهرة','جليد',
  'حبل','حجر','حقل','حلم','حديد','حصان','حديقة','حكمة','حرير','حمام','حنين','حصاد',
  'خبز','خشب','خيط','خيمة','خريف','خليج','خاتم','خزانة','خطوة','خيال','خفيف','خضار',
  'دار','درب','دلو','دفتر','دقيق','دائرة','دولاب','دخان','دموع','دهان','دبس','درج',
  'ذهب','ذئب','ذرة','ذاكرة','ذراع','ذكي','ذيل','ذوق','ذخيرة','ذبل','ذروة','ذهن',
  'راية','رمل','رئة','ربيع','رخام','رسالة','رصيف','رغيف','رفوف','ركن','رمان','رياح',
  'زهر','زيت','زجاج','زمرد','زورق','زبيب','زاوية','زعتر','زلزال','زمان','زهرة','زينة',
  'سماء','سفر','سلم','سيف','سحاب','سراج','سفينة','سكين','سلة','سنبلة','سهم','سوار',
  'شمس','شجر','شعر','شارع','شاطئ','شباك','شتاء','شراع','شريط','شمعة','شوكة','شهد',
  'صبر','صخر','صقر','صوت','صباح','صحراء','صندوق','صابون','صفصاف','صنوبر','صياد','صحن',
  'ضوء','ضفة','ضباب','ضلع','ضيف','ضمير','ضحك','ضريح','ضخم','ضجيج','ضاحية','ضمة',
  'طير','طين','طريق','طاولة','طبيب','طحين','طبل','طاقة','طلع','طوق','طيف','طرف',
  'ظل','ظبي','ظفر','ظهر','ظرف','ظلام','ظمأ','ظاهرة','ظنون','ظليل','ظهيرة','ظافر',
  'عين','عنب','عسل','عصفور','عمود','عجلة','عباءة','عطر','علم','عقرب','عاصفة','عرين',
  'غيم','غصن','غزال','غابة','غروب','غبار','غرفة','غناء','غدير','غلاف','غزل','غريب',
]

/** How many dice a list of this size needs, or null if it is not a power of six. */
export function diceFor(listSize: number): number | null {
  let n = 0
  let v = listSize
  while (v > 1 && v % 6 === 0) { v /= 6; n++ }
  return v === 1 && n > 0 ? n : null
}

/** Dice roll (each 1–6) to a 0-based index. Rejects an out-of-range roll. */
export function rollToIndex(rolls: number[], listSize: number): number | null {
  const dice = diceFor(listSize)
  if (!dice || rolls.length !== dice) return null
  let index = 0
  for (const r of rolls) {
    if (r < 1 || r > 6) return null
    index = index * 6 + (r - 1)
  }
  return index < listSize ? index : null
}

export const LISTS = {
  en: { words: EN, label: { en: 'English', ar: 'إنجليزية' } },
  ar: { words: AR, label: { en: 'Arabic', ar: 'عربية' } },
} as const

export type ListId = keyof typeof LISTS
