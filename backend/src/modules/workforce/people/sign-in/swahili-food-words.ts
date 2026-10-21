/**
 * The words a temporary password is built from (finding 43): short Swahili food and drink words, lowercase letters only.
 * FIRST DRAFT: the owner approved the idea and a sample; a Swahili speaker must review the full list before launch
 * (spelling, and nothing that reads badly next to another word). Keep it at 250 words or more, all different.
 * Changing the list changes nothing already issued: a password is never re-checked against it.
 */
export const SWAHILI_FOOD_WORDS: readonly string[] = [
  // drinks
  'maji', 'kahawa', 'chai', 'maziwa', 'mtindi', 'togwa', 'mbege', 'madafu', 'juisi', 'soda', 'kakao', 'mnazi', 'uji', 'mgando', 'mursik', 'chamomile',
  // breads, grains, snacks
  'mkate', 'mandazi', 'chapati', 'ugali', 'wali', 'pilau', 'biriani', 'mahindi', 'mtama', 'ulezi', 'shayiri', 'ngano', 'unga', 'mchele', 'tambi',
  'kitumbua', 'vitumbua', 'mahamri', 'kaimati', 'bhajia', 'samosa', 'sambusa', 'keki', 'biskuti', 'donati', 'mikate', 'maandazi', 'chipsi', 'mkatemayai',
  'kashata', 'halua', 'barafu', 'aiskrimu', 'pipi', 'bagia', 'kachori', 'mahindi', 'popkoni', 'bumunda',
  // meat, fish, eggs
  'nyama', 'kuku', 'samaki', 'mayai', 'mbuzi', 'kondoo', 'bata', 'dagaa', 'kamba', 'pweza', 'ngisi', 'changu', 'kolekole', 'sato', 'mkunga', 'mshikaki',
  'kebabu', 'mchuzi', 'supu', 'mtori', 'kitoweo', 'mseto', 'mchemsho', 'githeri', 'mukimo', 'irio', 'matoke', 'kiini', 'utumbo', 'maini', 'mkia', 'firigisi', 'mapaja',
  'nyamachoma', 'kukupaka', 'tilapia', 'omena', 'kitimoto', 'nguruwe', 'sungura', 'njiwa', 'bata', 'kaa', 'kamba',
  // beans, nuts, seeds
  'maharagwe', 'kunde', 'dengu', 'choroko', 'njegere', 'fiwi', 'mbaazi', 'karanga', 'njugu', 'korosho', 'ufuta', 'alizeti', 'lozi', 'pistachio', 'kokwa',
  // vegetables
  'sukuma', 'mchicha', 'kabichi', 'karoti', 'nyanya', 'kitunguu', 'vitunguu', 'saumu', 'pilipili', 'hoho', 'biringanya', 'bamia', 'matembele', 'managu',
  'mrenda', 'mboga', 'kachumbari', 'saladi', 'tango', 'maboga', 'boga', 'figili', 'spinachi', 'brokoli', 'kisamvu', 'mtunguja', 'terere', 'mnavu', 'mchunga',
  'chakula', 'kinywaji', 'kiamsha', 'kisima', 'mkate', 'mapishi', 'vitafunio', 'kiporo', 'chajio', 'uyoga', 'mwani', 'mlenda', 'mgagani', 'mchuzi',
  // roots
  'viazi', 'muhogo', 'magimbi', 'kiazi', 'nduma', 'mikoko', 'arrow', 'mihogo', 'kimanga', 'viazitamu', 'karafuu', 'mkwaju', 'mzizi', 'kiazikikuu', 'kiazimbatata',
  // fruit
  'ndizi', 'embe', 'papai', 'parachichi', 'nanasi', 'tikiti', 'chungwa', 'limau', 'ndimu', 'zabibu', 'tufaha', 'pera', 'peasi', 'fenesi', 'nazi', 'tende',
  'stafeli', 'ubuyu', 'mtopetope', 'zambarau', 'mpera', 'pesheni', 'stroberi', 'balungi', 'ukwaju', 'mabungo', 'matunda', 'mapera', 'mananasi', 'maembe', 'machungwa',
  'mandimu', 'komamanga', 'tini', 'mkomamanga', 'mfenesi', 'mpapai', 'mnazi', 'dafu', 'kiwi', 'blueberi', 'cheri', 'mulberi', 'limao', 'kunazi', 'matufaha',
  // spices, fats, sweet
  'chumvi', 'sukari', 'asali', 'iliki', 'mdalasini', 'binzari', 'bizari', 'jira', 'giligilani', 'mchaichai', 'mnanaa', 'kungumanga', 'hiliki', 'siki', 'mafuta',
  'siagi', 'jibini', 'tangawizi', 'ndimu', 'basili', 'oregano', 'rosemari', 'tamu', 'chachu', 'pilipilimanga', 'curry', 'masala', 'zafarani',
  'sharubati', 'jamu', 'maple', 'karameli', 'chokoleti', 'kahawatamu', 'maziwalala', 'cream', 'krimu', 'barafuto', 'chipukizi', 'mchaicha', 'tamarindo',
];
