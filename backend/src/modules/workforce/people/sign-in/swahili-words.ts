/**
 * The words a temporary password is built from (finding 43): short, pleasant Swahili words, lowercase letters only.
 * Food and drink, nature, colours, places and friendly everyday words.
 * FIRST DRAFT: a Swahili speaker must review the full list before launch (spelling, meaning, and nothing that reads
 * badly next to another word). Rules: one word each, 3 to 7 letters, easy to read aloud and spell, no accents, nothing
 * rude, sad or sensitive, no duplicates, no two words one letter apart (sign-in.test.ts checks all of these).
 * Keep it at 250 words or more. Changing the list changes nothing already issued: a password is never re-checked against it.
 */
export const SWAHILI_WORDS: readonly string[] = [
  // drinks and sweet things
  'maji', 'chai', 'kahawa', 'maziwa', 'mtindi', 'uji', 'togwa', 'juisi', 'kakao', 'asali', 'sukari', 'ndimu', 'madafu', 'dafu', 'vitamu',
  // bread, grains, dishes
  'mkate', 'mandazi', 'chapati', 'ugali', 'wali', 'pilau', 'mahindi', 'unga', 'mchele', 'ngano', 'mtama', 'ulezi', 'supu', 'mchuzi',
  'keki', 'halua', 'tambi', 'mseto', 'githeri', 'matoke', 'kachori', 'samosa', 'bhajia', 'mahamri', 'kashata', 'mkunga', 'chakula',
  // protein
  'nyama', 'kuku', 'samaki', 'mayai', 'dagaa', 'omena', 'tilapia', 'sato', 'jibini', 'siagi', 'karanga', 'njugu', 'korosho', 'dengu',
  'choroko', 'mbaazi', 'fiwi', 'kunde', 'alizeti', 'ufuta', 'pweza', 'ngisi', 'changu',
  // vegetables and roots
  'sukuma', 'mchicha', 'kabichi', 'karoti', 'nyanya', 'bamia', 'uyoga', 'mboga', 'viazi', 'muhogo', 'nduma', 'saumu', 'hoho',
  'figili', 'terere', 'mnavu', 'managu', 'mbegu', 'mavuno',
  // fruit
  'ndizi', 'embe', 'papai', 'nanasi', 'tikiti', 'chungwa', 'limau', 'zabibu', 'tufaha', 'pera', 'nazi', 'tende', 'ubuyu', 'tini',
  'fenesi', 'pesheni', 'stafeli', 'balungi', 'matunda',
  // kitchen and table
  'sahani', 'kikombe', 'kijiko', 'sufuria', 'jiko', 'meza', 'kiti', 'chumvi', 'viungo', 'iliki', 'karafuu', 'bilauri', 'kopo', 'chupa',
  'sinia', 'mwiko',
  // nature
  'jua', 'mwezi', 'nyota', 'mvua', 'upepo', 'mlima', 'bonde', 'ziwa', 'bahari', 'pwani', 'mawe', 'mti', 'mkuyu', 'jani', 'nyasi',
  'msitu', 'shamba', 'bustani', 'kisiwa', 'wingu', 'radi', 'umeme', 'ndege', 'nyuki', 'kipepeo', 'simba', 'twiga', 'tembo', 'kiboko',
  'swala', 'kobe', 'bundi', 'tausi', 'kasuku', 'korongo', 'mbuni', 'tumbili', 'ngamia', 'punda', 'farasi', 'machweo',
  'mawio', 'mbingu',
  // colours and things that shine
  'kijani', 'manjano', 'waridi', 'buluu', 'dhahabu', 'fedha', 'rangi', 'nuru', 'taa', 'almasi', 'lulu', 'kijivu', 'nyeusi', 'nyeupe',
  'mwanga',
  // places
  'nyeri', 'nairobi', 'mombasa', 'kisumu', 'nakuru', 'kenya', 'afrika', 'arusha', 'kilele', 'kijiji', 'soko', 'duka',
  // friendly everyday words
  'pendo', 'furaha', 'amani', 'heri', 'baraka', 'zawadi', 'rafiki', 'jambo', 'karibu', 'asante', 'salama', 'tamu', 'safi', 'nzuri',
  'hodi', 'bora', 'imara', 'hekima', 'busara', 'neema', 'heshima', 'subira', 'tumaini', 'ndoto', 'wimbo', 'nyimbo', 'ngoma', 'dansi',
  'safari', 'kicheko', 'wema', 'ukarimu', 'umoja', 'ushindi', 'nguvu', 'jirani', 'mgeni',
  // home and everyday things
  'daraja', 'mlango', 'dirisha', 'mkeka', 'kitanda', 'kanga', 'kitenge', 'kofia', 'viatu', 'kitabu', 'kalamu', 'mfuko', 'kikapu', 'gari',
  'mashua', 'mkono', 'moyo', 'mshumaa', 'bendera', 'kioo', 'mkoba',
  // time and number words
  'asubuhi', 'mchana', 'jioni', 'usiku', 'leo', 'kesho', 'wiki', 'mwaka', 'mbili', 'tano', 'sita', 'tisa', 'kumi',
];
