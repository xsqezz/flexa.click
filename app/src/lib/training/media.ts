export type ExerciseVideo = { id: string; title: string; channel: string; lang: string }

const CONSENT_KEY = 'flexa:youtube'

const video = (id: string, title: string, channel: string, lang = 'pl'): ExerciseVideo => ({ id, title, channel, lang })
const jumpingJacks = video('yC15l7aqXx0', 'Pajacyki - zobacz, jak prawidłowo wykonywać to popularne ćwiczenie', 'Drużyna Energii')
const catCow = video('ffxz83LANnY', 'Kocie grzbiety / Cat Cow', 'Trener Paweł Pakuła')
const deadBug = video('e2Rt8jqO3HY', 'SILNA PRO | Dead Bug | technika i wykonanie', 'Karolina Kałuża')
const dumbbellRow = video('Ihtkzra1nFk', 'Wiosłowanie w podparciu hantlem', 'Myfitweb')
const hipThrust = video('ezEQkeQWMPM', 'HIP THRUST - Podstawowe ćwiczenie na pośladki', 'ProFi Academy')
const bodyweightSquat = video('dpGBAZBzCo0', 'Przysiady z ciężarem własnego ciała', 'Karta MultiSport')
const splitSquat = video('cxdcy6u0G24', 'Przysiad wykroczny / Split Squat', 'Trener Paweł Pakuła')
const stepUp = video('kwPsKLaM5vM', 'Wejścia na stopień z obciążeniem.', 'TI FITNESS')
const calfRaise = video('B7wWr1RGadg', 'Wspięcia na palce stojąc / Calf raises', 'Trener Paweł Pakuła')
const hipHinge = video('RFXwyfzrpsM', 'Hip Hinge (zawias biodrowy) – podstawowe ćwiczenie dla początkujących i sportowców', 'Centrum Ruchu Perfecto')
const pullThrough = video('jxM-QhknE-o', 'BAND PULL THROUGH - Wypychanie miednicy stojąc z gumą', 'TRAINERON')
const gluteBridge = video('6DMwHvSngWQ', 'Mostek biodrowy / Glute Bridge', 'Trener Paweł Pakuła')
const pullApart = video('HRNgsc5nEt0', 'Rozciąganie gumy przed sobą / Band pull apart', 'Daniel Pytel')
const lateralRaise = video('hrZkDCz4th0', 'Jak wykonać unoszenie hantli bokiem | Technika ćwiczenia', 'Męski Balans')
const pushdown = video('sAvmhbGzkSk', 'Prostowanie ramion przy górnym wyciągu - TRICEPS ĆWICZENIA|Podstawy dla początkujących|M. Karmowski', 'ZapytajTrenera.pl')
const farmerCarry = video('n1LJ3AjQVKQ', 'Spacer farmera z hantlami/ Farmer walk db carry', 'Body Condition Center - Trening Personalny')
const chinTuck = video('ZhlUzdLr-Oo', 'Cofanie brody stojąc plecami do ściany / Wall chin tuck #exsercise', 'Daniel Pytel')
const wallSlide = video('Ai7tHW_TRlo', 'Wall Slides Exercise', 'PLAE', 'en')
const pallof = video('209tY0THB_I', 'Pallof Press Z Gumą Oporową - Poprawna Technika', 'Dawid Kumala')
const openBook = video('Abtl85QtvyQ', 'Floor T-spine rotation / Rotacja w odcinku piersiowym w leżeniu', 'Boska Makowska')
const ankleMobility = video('0H6ivqmwLYw', 'Knee to wall ankle mobilisation', 'Tanya Carroll', 'en')
const bikeSetup = video('KoVcyjMKoGs', '3 proste kroki jak ustawić rower stacjonarny w Twoim domu', 'GymioSport')
const walking = video('X3yeQ_nntfM', 'Technika chodzenia- Jak poprawnie chodzić odc.2 | Film Instruktażowy | WalkingLovers Korzeniowscy', 'Walking Lovers')
const legCurl = video('fz7VgLKlbcA', 'Uginanie Nóg Na Maszynie Leżąc - Poprawna Technika', 'Dawid Kumala')

/**
 * Instructional videos, each verified with YouTube oEmbed (the video exists and allows embedding).
 * Variants of the same movement intentionally share one demonstration.
 */
export const exerciseVideos: Record<string, ExerciseVideo> = {
  'jumping-jacks': jumpingJacks,
  'wu-jumping-jack': jumpingJacks,
  'cat-cow': catCow,
  'wu-cat-cow': catCow,
  'dead-bug': deadBug,
  'wu-dead-bug': deadBug,
  'goblet-squat-db': video('ESeQVOgVORc', 'Przysiad z hantlem (goblet squat)', 'Karta MultiSport'),
  'goblet-squat-kb': video('Yx2yaznmPHc', 'Goblet squat – przysiad z kettlem lub hantelką', 'Fit Expert'),
  'bulgarian-split-squat-db': video('a8W5GnRKiQM', 'Przysiad bułgarski z hantlami | Bulgarian Split Squat | (czworogłowe, pośladki)', 'Patryk Konicki'),
  'bulgarian-split-squat': video('ugdepxAT2cw', 'Przysiad bułgarski - poprawna technika - Atlas ćwiczeń', 'FitRepublic'),
  'reverse-lunge-weighted': video('erih7EpsuH4', 'Wykroki w tył z hantlami / zakroki', 'Kobieta Na Bombie'),
  'reverse-lunge': video('-Wk_WZiW8G8', 'Jak wykonać wypad w tył | Reverse Lunge', 'Męski Balans'),
  'chair-squat': video('5zj0_-hSUt8', 'Przysiad do krzesła z hantlem 🍑🔥 Technika krok po kroku!', 'fitfuriapo40 (FIT-POL)'),
  'bodyweight-squat': bodyweightSquat,
  'wu-squat': bodyweightSquat,
  'miniband-squat': video('gM8IAQq51uU', 'Przysiad z gumą na kolanach / Air Squat with mini band', 'Body Condition Center - Trening Personalny'),
  'band-squat': video('Oom0fy-gTLU', 'Przysiad z gumą', 'Fit Expert'),
  'sumo-squat': video('50VuZYrP3i0', 'Sumo Przysiad z Hantlem | Dumbbell Sumo Squat | anthletic.com', 'Anthletic- Ewelina Skorczyk'),
  'pause-squat': video('W0fXQ8YUylk', '#3 Pause Squat + Breathing Squat / Przysiad z Pauzą Technika Wykonanie', 'StudioMocy'),
  'wall-sit': video('91_-eD07ShI', 'Krzesełko przy ścianie / Wall sit exercise', 'Daniel Pytel'),
  'leg-press': video('NIj3jH-mIag', 'Wypychanie nogami na suwnicy, technika #fitporady #sports #gymtips', 'CezaryP'),
  'back-squat-bb': video('WCg1tUgfWOo', 'Przysiad ze sztangą trzymaną na plecach', 'Fit Expert'),
  'front-squat-bb': video('9uaVqRQhWCg', 'Barbell Front Squat | Przysiad przedni ze sztangą', 'Any Fitness Coach'),
  'split-squat': splitSquat,
  'split-squat-db': splitSquat,
  'step-up': stepUp,
  'step-up-db': stepUp,
  'walking-lunge-db': video('B9mC1FQhoQs', 'Wykroki chodzone z hantlami', 'Myfitweb'),
  'lateral-lunge': video('ArjcIG24tic', 'Jak wykonać wykrok boczny | Lateral Lunge', 'Męski Balans'),
  'calf-raise': calfRaise,
  'calf-raise-step': calfRaise,
  'calf-raise-db': calfRaise,
  'calf-raise-machine': video('5LPGlQykNFU', 'Maszyna do wspięć na palce', 'Karta MultiSport'),
  'single-leg-stand': video('3Usyo9UDCE0', 'Ćwiczenie wzmacniające kończyny dolne. Stanie na jednej nodze - dr Marian Majchrzycki', 'dr Marian Majchrzycki - osteopata'),
  'tandem-walk': video('_P6hykdXx_U', 'Tandem Walk Exercise | Fall Prevention & Balance Training in 1 Minute', 'Sehat Te Physiotherapy', 'en'),
  'hip-hinge': hipHinge,
  'wu-hinge': hipHinge,
  'pull-through-band': pullThrough,
  'pull-through-cable': pullThrough,
  'good-morning-band': video('0h-ODIvYtms', '„Dzień dobry” z gumą | Banded Good Morning | (mięśnie dwugłowe)', 'Patryk Konicki'),
  'kb-deadlift': video('g1ZPsxzDsnI', 'PODSTAWY KETTLEBELL | Jak poprawnie wykonać martwy ciąg z kettlem?', 'Faster Setup'),
  'kb-swing': video('v3wnrSluDcw', 'How to Do a Kettlebell Swing PROPERLY | Complete Beginner Tutorial', 'Move Like Human', 'en'),
  'rdl-bb': video('LFSz_gdW-pw', 'Rumuński Martwy Ciąg - PRAWIDŁOWA Technika (Przestań Popełniać Te Błędy)', "Piotr 'Szmexy' Tomaszewski"),
  'deadlift-bb': video('zc3ozITlEro', 'Klasyczny martwy ciąg - poprawna technika wykonania', 'FitRepublic'),
  'back-extension': video('Nqa7o8iUNqE', 'WYPROSTY TUŁOWIA NA ŁAWCE RZYMSKIEJ 🍑 WYJAŚNIJMY w końcu WSZYSTKIE WĄTPLIWOŚCI!', 'Trener Do Celu z Pasją Przemysław Wójcik'),
  'glute-bridge': gluteBridge,
  'glute-bridge-miniband': gluteBridge,
  'wu-bridge': gluteBridge,
  'single-leg-bridge': video('rMYeYyZnpJ8', 'Mostki biodrowe jednonóż / Single leg glute bridge #instruktaż #glutebridge', 'Daniel Pytel'),
  'lateral-band-walk': video('M4cT7TysaQg', 'Chodzenie z mini bandem - do boku - zgięte kolana', 'GETBETTER GYM'),
  clamshell: video('sbDKTNeEknM', 'Muszelka mini band /Clam shell mini band', 'Body Condition Center - Trening Personalny'),
  'hip-abduction-machine': video('I98WsAdt5fQ', 'Odwodzenie nóg na maszynie', 'Fit Expert'),
  'leg-curl-machine': legCurl,
  'towel-leg-curl': video('lJt9GDCd7n0', "Slider leg curl - Uginanie nóg ze slide'ami", '_julia.coach_'),
  'rdl-db': video('cC-JQVoXkWc', 'Rumuński martwy ciąg z hantlami na dwugłowe uda | Hamstring Dumbbell RDL – technika krok po kroku', 'Jacek Lewiński'),
  'rdl-kb': video('6ydWzKgN7CY', 'Rumuński martwy ciąg z hantlami | Dumbbell Romanian Deadlift | (dwugłowe, pośladki)', 'Patryk Konicki'),
  'single-leg-rdl-weighted': video('v0oBi8aOVV8', '#12 Nogi - Martwy ciąg na jednej nodze z hantlem', 'Train Me Now'),
  'single-leg-rdl': video('hBPoprhxFRQ', 'MARTWY CIĄG NA JEDNEJ NODZE - POPRAWNA TECHNIKA', 'ProFi Academy'),
  'hip-thrust-db': video('Ewi3TgWS7pE', 'Wypychanie bioder z hantlą | Dumbbell Hip Thrust | (pośladki)', 'Patryk Konicki'),
  'hip-thrust-couch': hipThrust,
  'hip-thrust-bb': video('O5VbakL1hXw', 'Hip thrust ze sztangą', 'Karta MultiSport'),
  'push-up': video('0rgpUIoFBWU', 'Push-ups / Pompki - Jak robić pompkę? Technika krok po kroku', 'Oskar Krawczyk'),
  'push-up-handles': video('E3h46-Xql9E', 'Jak prawidłowo robić pompki?', 'FitnessPlatinium'),
  'floor-press-db': video('pEX4ycQ29HU', 'DUMBBELL FLOOR PRESS - Wyciskanie hantli na podłodze', 'TRAINERON'),
  'standing-db-press': video('32rybj05WRY', 'Wyciskanie hantli nad głowę stojąc', 'Sebastian Chmielecki Trener Personalny'),
  'seated-db-press': video('ZHH6hV6vhPo', 'Jak wykonać wyciskanie hantli nad głowę | Technika ćwiczenia', 'Męski Balans'),
  'db-row': dumbbellRow,
  'kb-row': dumbbellRow,
  'backpack-row': dumbbellRow,
  'band-seated-row': video('3TYtXgb9kzY', 'Wiosłowanie gumą siedząc', 'Jan Słoniewicz'),
  'wall-push-up': video('l_YzMNZ6IdY', 'POMPKA PRZY ŚCIANIE - PORADNIK CALISCHOOL', 'CaliSchool'),
  'incline-push-up': video('wFD-jkJK5Sw', '✅ How to do HANDS-ELEVATED PUSH-UPS -  INCLINE PUSH-UPS QUICK TUTORIAL', 'The Coach Who Cares', 'en'),
  'knee-push-up': video('hwmChWb7u40', 'Pompki Na Kolanach - Poprawna Technika', 'Dawid Kumala'),
  'decline-push-up': video('quBzTlHd7tE', 'Pompki z nogami na podwyższeniu | Decline Push-Up | (klatka)', 'Patryk Konicki'),
  'close-push-up': video('8NU0ytSKpCM', 'Pompki diamentowe - poprawna technika - Atlas ćwiczeń', 'FitRepublic'),
  'pike-push-up': video('ZtHxpQ2Fv5g', 'Jak poprawnie zrobić pompki pike? To najlepsze ćwiczenie do pompek na rękach…', 'Wiktor "Calisthenos" Piurek'),
  'bench-press-db': video('IJ9H9uJnMRA', 'Wyciskaj hantle jak PRO! 💪 Prawidłowa technika 🏋️‍♂️', 'Świat_Fitnessu 💪'),
  'incline-press-db': video('Pqde13uj33E', 'Wyciskanie Hantli - NIE POPEŁNIAJ TYCH BŁĘDÓW ( Technika w 7 Krokach )', "Piotr 'Szmexy' Tomaszewski"),
  'bench-press-bb': video('CzDIo3vF9Rc', 'Wyciskanie Sztangi Leżąc Technika', 'Góral'),
  'chest-press-machine': video('9ZE-Y9NSScQ', 'Wyciskanie na klatę, na maszynie. CHEST PRESS. Poprawna technika, ustawienie maszyny.', 'Po prostu trening - czyli trening dla każdego'),
  'band-chest-press': video('Guf6cDnrMgs', 'WYCISKANIE NA KLTKĘ GUMY ZACZEPIONEJ Z TYŁU ĆWICZENIE NA KLATKĘ PIERSIOWĄ, BARKI, TRICEPS', 'treneralbatroPL'),
  'kb-press': video('Nt_AFVfWpiw', 'Wyciskanie jednorącz kettla nad głowę/ OHP single hand kb', 'Body Condition Center - Trening Personalny'),
  'band-overhead-press': video('9QoAb5wZ_Qo', 'BAND PRESS - Wyciskanie gumy nad głowę', 'TRAINERON'),
  'landmine-press': video('JrshIJLbwvA', 'LANDMINE PRESS SINGLE ARM STANDING | Wyciskanie półsztangi jednorącz stojąc | WIDEO BAZA ĆWICZEŃ', 'Radosław Zarzycki - Być jak Herkules'),
  'ohp-bb': video('EBb2X6OhZlQ', 'Jak prawidłowo wykonać wyciskanie żołnierskie (OHP, overhead press, military press)', 'pawelmakarewicz.pl'),
  'machine-shoulder-press': video('7gKMOruknSY', 'Wyciskanie na maszynie nad głowę – wzmocnij barki i zyskaj pewność w ramionach! 🏋️‍♂️🔥', 'Alpha Gym'),
  'band-pull-apart': pullApart,
  'wu-pull-apart': pullApart,
  'band-face-pull': video('BbXoAhYK418', 'Shark Training - przygotowanie motoryczne: FACE PULL Z GUMĄ', 'Shark Training'),
  'cable-face-pull': video('NdTbWMjTBRg', 'Face pull', 'Karta MultiSport'),
  'db-rear-fly': video('Ags9JoezCFg', 'Odwrotne rozpiętki z hantlami w opadzie tułowia(Bent Over Dumbbell Reverse Fly)', 'Jacek Lewiński'),
  'reverse-fly-machine': video('5b-oMMoTLzE', 'Maszyna do odwrotnych rozpiętek (reverse fly)', 'Karta MultiSport'),
  'db-lateral-raise': lateralRaise,
  'band-lateral-raise': lateralRaise,
  'cable-lateral-raise': lateralRaise,
  'band-external-rotation': video('z5qcmQ384D4', 'Izometryczna rotacja zewnętrzna barku z gumą oporową / Banded Isometric Shoulder External Rotation', 'Trener Paweł Pakuła'),
  'db-overhead-extension': video('I5vkujoMjno', 'Prostowanie ramion hantlą nad głowę/ Triceps DB press', 'Body Condition Center - Trening Personalny'),
  'db-skull-crusher': video('XTrjvhs9FZg', 'Wyciskanie francuskie hantli leżąc - poprawna technika - Atlas ćwiczeń', 'FitRepublic'),
  'cable-pushdown': pushdown,
  'band-pushdown': pushdown,
  'chair-dip': video('t7fcNxj9Snw', 'DIPY | Na krzesłach! | Trening w domu! #kalistenika #treningwdomu', 'Patryk Wygadańczuk'),
  'chest-supported-db-row': video('FTpr4DtpTIs', 'Wiosłowanie hantlami w podporze o ławkę.', 'Architekt-Sylwetki'),
  'band-standing-row': video('FllnG4pFvck', 'Resistance Band Row (Wiosłowanie z gumą oporową stojąc)', 'Dominik.Warmiłło'),
  'cable-row': video('kKxzjlgqFUY', 'Wiosłowanie na dolnym wyciągu siedząc, oburącz', 'Pawlito_tito'),
  'inverted-row': video('v4mkZ0MlSRc', 'AUSTRALIAN ROW | Wiosłowanie australijskie | body row | WIDEO BAZA ĆWICZEŃ HERKULESA', 'Radosław Zarzycki - Być jak Herkules'),
  'bb-row': video('4R0zm6kZ0Kc', 'Wiosłowanie sztangą w opadzie tułowia', 'FitRepublic'),
  'band-lat-pulldown': video('45V3o5wf4bE', 'BAND LAT PULL DOWN - Ściąganie gumy do klatki piersiowej', 'TRAINERON'),
  'band-straight-arm-pulldown': video('s7NEDKIvGvE', 'Narciarz z gumą | Banded Straight Arm Pulldown | (plecy)', 'Patryk Konicki'),
  'lat-pulldown': video('cpzcs1j2VCw', 'JAK WYKONYWAĆ LAT PULLDOWN (ściąganie drążka) - Poradnik', 'Wiktor Strap'),
  'assisted-pull-up': video('2GMyPf3wbrQ', 'Podciąganie nachwytem na maszynie / Assisted machine pull up over grip #siłownia #instruktaż', 'Daniel Pytel'),
  'scap-pull-up': video('jpH-osBQkOg', 'Scapular Pull-Up Exercise | Form, Tips & Common Mistakes', 'FIT.nl', 'en'),
  'negative-pull-up': video('u3rtaN8LU4Y', 'Negatywne podciąganie (opuszczanie) - nauka podciągania #pullups #podciąganie #shorts', 'Patryk Wygadańczuk'),
  'band-assisted-pull-up': video('GMOmXtKPHs0', 'Podciąganie z gumą nauka', 'FinityPL'),
  'pull-up': video('Opahuwz-J3I', 'Podciąganie na drążku nachwytem - poprawna technika - Atlas ćwiczeń', 'FitRepublic'),
  'chin-up': video('CXAc0ZNhSJs', 'Chin-Up (Podciąganie podchwytem)', 'Dominik.Warmiłło'),
  'db-curl': video('YHyaCI8O1Eg', 'Jak wykonać uginanie ramion podchwytem z hantlami | Technika ćwiczenia', 'Męski Balans'),
  'hammer-curl': video('_dswIxT--Vw', 'Hammer Curl - MŁOTKOWE UGINANIE! Mocne przedramiona!', 'THORN FIT'),
  'band-curl': video('oICpYDEf2yc', 'Uginanie ramion z gumą z supinacją (Band Supinating Bicep Curl)', 'Jacek Lewiński'),
  'cable-curl': video('SxZwTVtocDc', 'Uginanie ramion na wyciągu stojąc | Standing Cable Biceps Curl – technika na biceps', 'Jacek Lewiński'),
  'bb-curl': video('rOY9-_qysgc', 'BICEPS ĆWICZENIA - Uginanie ramion ze sztangą podchwytem|Podstawy dla początkujących|M. Karmowski', 'ZapytajTrenera.pl'),
  'farmer-carry-db': farmerCarry,
  'farmer-carry-kb': farmerCarry,
  'suitcase-carry': video('a1a3wwNBDZU', 'Suitcase Carry, AKA Single Arm Farmers Walk', 'Coach Tim Sunderland', 'en'),
  'chin-tuck': chinTuck,
  'wu-chin-tuck': chinTuck,
  'wall-slide': wallSlide,
  'wu-wall-slide': wallSlide,
  'prone-ytw': video('vI1084JlEjs', 'YTW Exercise', 'Elite Performance Institute', 'en'),
  'thoracic-extension': video('d6na7gO5na8', 'Thoracic Extension and Strengthening Exercises for Posture, Upper Back Pain | Chiropractor Explains', 'Dr Donald A Ozello DC, NSCA-CPT', 'en'),
  'superman-alternating': video('zo2w-mx-c9w', 'Naprzemienne unoszenie ręki i nogi w leżeniu na brzuchu', 'Any Fitness Coach'),
  'side-plank': video('G3Jm3SUJzqI', 'Deska boczna - jak wykonać side plank?', 'Medicover GO'),
  'side-plank-knees': video('3Nf9xCLLm9Y', 'BOCZNA DESKA | Od Czego Zacząć? | Poznaj Prawidłową Technikę', 'Fitness bez Ściemy'),
  burpee: video('SgKiiyf12O0', 'Burpees - Ćwiczenie / Prawidłowa Technika', 'FITMADE'),
  plank: video('lBPcohsyE3I', 'Plank (deska) | Prawidłowe wykonanie | Instrukcja, podpowiedzi i punkty kluczowe', 'Jak żyć długo, zdrowo i szczęśliwie?'),
  'plank-knees': video('uJ1X9ZGXYBI', 'Deska na kolanach/ Plank on knee', 'Body Condition Center - Trening Personalny'),
  'bear-hold': video('H3H8KmpPpMA', 'Przytrzymanie w pozycji niedźwiedzia', 'Łukasz Bruski - Trener Rodzinny'),
  'hollow-hold': video('O9HcEtL9NQA', 'Hollow body / pozycja wklęsła, „łódka”', 'Boska Makowska'),
  'hanging-knee-raise': video('Psi_U1erg6Y', 'Hanging Knee Raise - Unoszenie kolan do klatki w zwisie na drążku', 'Marcin Jaksender'),
  'bird-dog': video('pXIGMO6Qwpg', 'Bird dog - Ćwiczenie / Prawidłowa Technika', 'FITMADE'),
  'pallof-band': pallof,
  'pallof-cable': pallof,
  'shoulder-tap-plank': video('qLEtpwG_qJo', 'PLANK SHOULDER TAPS', 'Combat Lab 365', 'en'),
  'mountain-climbers': video('O6rTKBNLexw', 'SILNA PRO | Mountain Climbers | technika i wykonanie', 'Karolina Kałuża'),
  'march-in-place': video('W39J4MurWzc', 'Marsz w miejscu z wysokim unoszeniem kolan / High Knees March', 'Trener Paweł Pakuła'),
  'step-intervals': video('JRE2HwgPAA4', 'Dumbbell Step Up / Wchodzenie na stepa - ćwiczenie na nogi i pośladki', 'Oskar Krawczyk'),
  'shadow-boxing': video('ao98LnJwzMw', 'Walka z cieniem - Instruktaż - Boks w domu', 'Maciej Kosicki'),
  'skater-steps': video('b8NSVWSp-WA', '⛸️ Low Impact Skaters | Beginner Cardio Workout Without Jumping', 'Prime Fitness', 'en'),
  'jump-rope': video('4Op28LaWlZ4', 'JAK SKAKAĆ NA SKAKANCE - NAUKA, PODSTAWY, JAK ZACZĄĆ', 'Fabryka Siły'),
  'jump-squat': video('ZxFJi9vRx4s', 'How to Do a Jump Squat Correctly | Quads Exercise Form Guide', 'BACK2BASICS', 'en'),
  'run-intervals': video('Ab2l5yhCtlE', 'TECHNIKA BIEGU: przebieżki w treningu biegacza', 'Trener Matner'),
  'db-thruster': video('kICcoGGy-4c', 'Jak wykonać thruster z hantlem | Technika ćwiczenia wydolnościowego', 'Męski Balans'),
  bike: bikeSetup,
  'wu-bike': bikeSetup,
  rower: video('4MiRVC1xEMc', 'Jak poprawnie wiosłować na wioślarzu / ergometrze wioślarskim - instruktarz #ergometr #wioslowanie', 'Ergometr wioślarski moje hobby'),
  elliptical: video('NzE66YbSeAY', 'Ćwiczenia na orbitrekach - jak ćwiczyć - inSPORTline', 'inSPORTline Polska'),
  'open-book': openBook,
  'cd-open-book': openBook,
  'hip-90-90': video('VtK_yhOF4Jc', 'POPRAW MOBILNOŚĆ BIODER POZYCJA- 90 90 - MACIEJ SOBAŃSKI', 'Przedsiębiorczy Trener'),
  'worlds-greatest-stretch': video('-CiWQ2IvY34', "The World's Greatest Stretch (Mobility Exercise) by Squat University", 'Squat University', 'en'),
  'ankle-rock': ankleMobility,
  'wu-ankle': ankleMobility,
  'wu-march': video('ONkCt4zM_BA', 'Ćwiczenia cardio. Marsz w miejscu', 'Bielsko-Biała Personalnie. Trener Kamil Myszka'),
  'wu-step-jack': video('Sjm2VtTlgBc', 'WF w domu - Pajacyki 10 najlepszych wariacji dla początkujących - trening w domu', 'BIELECKI-ES'),
  'wu-arm-circles': video('DFRWn9sg8T4', 'krążenia prostych ramion #rozgrzewka #siłownia', 'Tomasz Urbańczyk'),
  'wu-hip-circles': video('3nsCPwN9i2M', 'Krążenia bioder w prawo / Hip Circles to the Right', 'Trener Paweł Pakuła'),
  'wu-leg-swings': video('sTXqxyq173k', 'Wymachy nóg w przód / Forward leg swings', 'Sebastian Karalus'),
  'wu-wall-push-up': video('jqenAQtRYGI', 'Jak prawidłowo wykonać SCAPULA PUSH UPS (pompki na łopatkach)? by FizjoInTouch', 'FizjoInTouch'),
  'wu-thoracic': video('9yxonRx-Z8w', 'Rotacje tułowia w klęku podpartym.', 'TI FITNESS'),
  'wu-inchworm': video('C4y--VmH-j4', 'How to Do an Inchworm Correctly | Core Exercise Form Guide', 'BACK2BASICS', 'en'),
  'wu-kb-halo': video('8-OCekqbNtc', 'Halo z kettlebell', 'THORN FIT'),
  'cd-breathing': video('opZMEDlJ8y0', 'Oddychanie przeponowe leżąc | RESET KRĘGOSŁUPA – program naprawczy na ból kręgosłupa lędźwiowego', 'Michał Ławrynowicz | Trener personalny'),
  'cd-hamstring': video('4f4Nx2MwFC0', 'Mobilność tylnej taśmy - rozciągnij uda *SPRAWDZONY ZESTAW ĆWICZEŃ*', 'Łukasz Panasiuk'),
  'cd-quad': video('I3M2NqP78Aw', 'Rozciąganie mięśnia czworogłowego uda - dr Marian Majchrzycki osteopata', 'dr Marian Majchrzycki - osteopata'),
  'cd-hip-flexor': video('lNRNJlNqNXY', 'Rozciąganie zginaczy stawu biodrowego', 'Karta MultiSport'),
  'cd-glute': video('5Ulc5-5zV2c', 'Supine Figure Four Stretch – Rozciąganie pośladka w leżeniu tyłem', 'Dzikiewicz Performance Training'),
  'cd-calf': video('t4vHNE9N86g', 'Rozciąganie łydki - napieranie na ścianę', 'Black Barbell'),
  'cd-chest': video('SKiCvrwf9RU', 'Rozciągaj klatkę, zniweluj GARB ✅️ #fizjoterapia', 'FizjoKris'),
  'cd-child': video('xW34xsO4G3c', "CHILD'S POSE POZYCJA DZIECKA💙🧘🔥 *Instrukcja dobrego ćwiczenia* *Trening*", 'Magi.HeallthyMistrz'),
  'cd-triceps': video('9o9yaXCD5cg', 'Ćwiczenie: Rozciąganie mięśni tricepsów - Atlas ćwiczeń - Michał Wrzosek by Olimp Sport Nutrition', 'Olimp Sport Nutrition'),
  'cd-neck': video('G2r3y4T7wdQ', 'ROZCIĄGANIE SZYI', 'Julia Żurawska'),
  'cd-butterfly': video('F4FIg3BquEQ', 'Rozciąganie w motylku u Trenera Gwiazd', 'www.dobry-trening.pl'),
  'prone-pulldown': video('q-qFjjKl1Ko', 'Prone W Raise – Fix Your Posture & Strengthen Your Upper Back', 'Train With Cuz', 'en'),
  'thread-the-needle': video('nZtSL3JhFV0', 'Rotacja odcinka piersiowego w klęku podpartym /Quadrupped T spine rotation', 'Body Condition Center - Trening Personalny'),
  'cd-lat': video('zTnQ66BYU6c', 'Rozciąganie mięśnia najszerszego grzbietu (Lat stretch) | Trenuj Lepiej #23', 'Kuba Seweryn'),
  'brisk-walk': walking,
  'cd-walk': walking,
  'incline-walk': video('IVH6xEaqWPs', 'Kroki i nachylenie na bieżni', 'Dawid Kopczyński'),
  'band-leg-curl': legCurl,
}

export function videoFor(exerciseId: string): ExerciseVideo | null {
  return exerciseVideos[exerciseId] ?? null
}

export function embedUrl(id: string, autoplay: boolean): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1${autoplay ? '&autoplay=1' : ''}`
}

export function youtubeSearchUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} jak wykonać`)}`
}

export function videosAllowed(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === 'on' } catch { return false }
}

export function allowVideos(value: boolean): void {
  try {
    if (value) localStorage.setItem(CONSENT_KEY, 'on')
    else localStorage.removeItem(CONSENT_KEY)
  } catch { /* The choice then lasts only for this view. */ }
}
