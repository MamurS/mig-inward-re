# MIG Inward Re — Administrator uchun qoʻllanma

Ushbu qoʻllanma administratorlar uchun. Administrator boshqa rollar bajaradigan hamma ishni bajara oladi, bundan tashqari **Boshqaruv** sahifasini yuritadi: foydalanuvchilar, maʼlumotnomalar, valyuta kurslari, sozlamalar, SI, rejalashtirilgan vazifalar va demo maʼlumotlar.

Har bir boʻlimning kundalik ishi haqida boshqa qoʻllanmalarni oʻqing: [Anderrayter](underwriter.md), [Moliya](finance.md), [Zararlar](claims.md) va [Rahbariyat](management.md).

## 1. Nimani koʻrasiz va nimani oʻzgartira olasiz

Ish **Dashboard** sahifasidan boshlanadi. Menyuning barcha bandlari, shuningdek **Boshqaruv** mavjud.

- Anderrayterlar, moliya va zararlar boʻlimlari bajaradigan hamma ishni bajara olasiz:
  - arizalar va holatlar;
  - mukofot jadvallari, tushumlar va hisobdan chiqarish;
  - zararlar, zaxiralar va toʻlovlar;
  - binderlar va borderolarning har uch turi.
- Barcha xodimlarning eslatmalarini koʻra olasiz. **Mening vazifalarim** sahifasida `assignee:all` deb qidiring.
- **Tasdiqlovchi hujjat** deb belgilanganidan tashqari istalgan hujjatni oʻchira olasiz.
- **Boshqaruv** sahifasida yettita yorliq bor: **Foydalanuvchilar va rollar**, **Ma’lumotnomalar**, **Valyuta kurslari**, **Sozlamalar**, **SI**, **Rejalashtirilgan vazifalar** va **Demo ma'lumotlar**.

## 2. Kundalik ishlar

### Foydalanuvchilar va rollar

1. **Yangi foydalanuvchi** tugmasini bosing. **Elektron pochta**, **Nomi**, **Rol** va **Vaqtinchalik parol** (kamida 10 belgi) ni kiriting.
2. **Yaratish** tugmasini bosing. Parol faqat bir marta koʻrsatiladi. Uni nusxalab, xodimga bering; u darhol tizimga kira oladi.
3. Xodimning ismi, roli yoki **Faol** belgisini oʻzgartirish uchun qatorni tahrirlang va undagi **Saqlash** tugmasini bosing.
4. Kalit belgili tugma yangi parol oʻrnatadi (**Yangi parol oʻrnatish**).

Ishdan ketgan xodimlar **oʻchirilmaydi, nofaol qilinadi** — shu bois ularning ismi bajargan ishlarida saqlanib qoladi. Roli "— ruxsat yoʻq —" boʻlgan foydalanuvchi "Ruxsat kutilmoqda" sahifasini koʻradi. Oʻzingizni nofaol qila olmaysiz.

Rollar: Administrator, Anderrayter, Moliya, Zararlar, Rahbariyat.

### Maʼlumotnomalar

- Uchta jadvalni yuriting: **Sugʻurta turlari**, **Valyutalar** va **Davlatlar**.
- Sugʻurta turlari va davlatlarda **Kod** hamda EN, RU va UZ tillaridagi nom bor.
- Yangi qator uchun **Qoʻshish** tugmasidan foydalaning. Mavjud kod qabul qilinmaydi.
- MGA, brokerlar va tsedentlar bu yerda emas, **Kontragentlar** sahifasida yuritiladi.

### Valyuta kurslari

- **Kursni qoʻshish / oʻzgartirish** boʻlimida valyuta va **Sana**ni tanlang, **1 … uchun USD** qiymatini kiriting va **Qoʻshish** tugmasini bosing.
- Kurs — valyutaning 1 birligi uchun necha USD olinishi.
- Summalar oʻz sanasidagi yoki undan oldingi eng soʻnggi kurs boʻyicha hisoblanadi.
- Kurslar avtomatik yuklanmaydi. Kursi yoʻq har qanday pozitsiya USD jamiga kirmaydi va ekranda sanab koʻrsatiladi.

### Sozlamalar

Sozlamalar guruhlarga ajratilgan. Standart qiymatlar:

| Guruh | Sozlama | Standart |
|---|---|---|
| Takliflar bo'yicha eslatmalar | Taklifdan keyingi birinchi eslatma (kun) | 7 |
| | Eslatmalarni har (kun) takrorlash | 7 |
| | Eski takliflarni avtomatik «Javob yo'q» ga o'tkazish | o'chirilgan |
| | …dan keyin (taklifdan beri kun) | 30 |
| Mukofotlar | Standart to'lov muddati (boshlanishdan kun) | 60 |
| | Birinchi kechikish eslatmasigacha imtiyoz (kun) | 0 |
| Zararlar | Yirik zarar chegarasi, USD (ulushimiz) | 250,000 |
| | Zaxira o'zgarmasa mas'ulga eslatish (kun) | 90 |

Kunlar 1 dan 365 gacha boʻlishi kerak (toʻlov muddati va imtiyoz uchun 0 dan 365 gacha). **Sozlamalarni saqlash** tugmasini bosing.

### SI

SI yordamida maʼlumot kiritish siz uni yoqmaguningizcha **o'chirilgan** boʻladi.

1. **Avval egasi bajaradigan amal:** provayder kaliti Supabase → Edge Functions → Secrets boʻlimiga kiritiladi (`ANTHROPIC_API_KEY`, ixtiyoriy ravishda `AI_PROVIDER` va `AI_MODEL`). U hech qachon ilovaga kiritilmaydi.
2. **SI** yorligʻida **Yoqilgan** belgisini qoʻying.
3. **Foydalana oladigan rollar**ni tanlang. Standart rollar: administrator, anderrayter, moliya va zararlar.
4. **Foydalanuvchiga kuniga so‘rovlar** sonini belgilang. Standart qiymat — 100, keshdan olingan javoblar hisoblanmaydi.
5. **Saqlash** tugmasini bosing.

Foydalanish jurnalida har bir soʻrov qayd etiladi: qachon, foydalanuvchi, turi (Ariza hujjati yoki Bordero ustunlari), holati, fayl, kirish va chiqish tokenlari. Unda hujjat ham, javob ham saqlanmaydi. Jurnalni `status:error|refused`, `kind:bordereau_mapping` yoki `date>=7d` kabi soʻzlar bilan qidiring.

Ikkala qadam bajarilmaguncha **Hujjatdan to‘ldirish** tugmasi koʻrinmaydi.

### Rejalashtirilgan vazifalar

- **Kundalik eslatma vazifasi** har kuni Toshkent vaqti bilan 08:15 da ishlaydi. U:
  - takroriy eslatmalarni yaratadi;
  - muddati oʻtgan takliflarni belgilaydi;
  - yoqilgan boʻlsa, eski takliflarni "Javob yoʻq" holatiga oʻtkazadi.
- **Hozir ishga tushirish** uni darhol ishga tushiradi.
- Jadvalda har bir ishga tushirish koʻrsatiladi: **Boshlangan**, **Ishga tushirish** (qoʻlda yoki jadval boʻyicha) va **Natija**.

### Demo maʼlumotlar

Demo maʼlumotlar oʻqitish va tizimni namoyish qilish uchun moʻljallangan. Ularning nomlari «DEMO» bilan, raqamlari DEMO- bilan boshlanadi.

- **Demo ma'lumotlarni yuklash** demo toʻplamni qoʻshadi. U faqat demo maʼlumotlar yuklanmagan paytda ishlaydi.
- **Bog'lanishlarni tekshirish** hech bir demo yozuv haqiqiy yozuv bilan bogʻlanmaganini tasdiqlaydi.
- **Barcha demo ma'lumotlarni o'chirish** barcha demo yozuvlarni, jumladan ularning jadvallari, tushumlari, eslatmalari va hujjatlarini oʻchiradi. Haqiqiy maʼlumotlarga tegilmaydi. Bu amalni qaytarib boʻlmaydi, uni tasdiqlashingiz kerak.

## 3. Maʼlumot qidirish

- Qidiruv satri siz turgan roʻyxat boʻyicha, jumladan Boshqaruv sahifasining har bir yorligʻida qidiradi:
  - foydalanuvchilar: `role:underwriter|finance`, `inactive`;
  - maʼlumotnomalar: `cargo`, `inactive`;
  - valyuta kurslari: `ccy:EUR|UZS, date>=2026-10-01`, `source:manual`.
- Satrga tez oʻtish uchun **Ctrl K** (Mac’da ⌘K) tugmalarini bosing. `,` — VA, `;` — YOKI, `-` — chiqarib tashlash. Filtr soʻzlari oʻzbekcha ham ishlaydi (masalan `nofaol`, `rol:`). **Sintaksis boʻyicha yordam** misollarni koʻrsatadi.
- Chiplar "Soʻrovingiz qanday tushunildi"ni koʻrsatadi. **Filtrlar** tugmasi qiymatlarni tanlab, **Qoʻllash** tugmasini bosish imkonini beradi.
- **Ustunlar** ustunlarni koʻrsatadi yoki yashiradi. **Excel’ga eksport** aynan soʻrovingiz koʻrsatayotgan qatorlarni eksport qiladi.

## 4. Koʻrinish

- **Til**: yuqori paneldagi EN / RU / UZ tugmasidan foydalaning.
- Ismingizni bosing, soʻng **Koʻrinish**ni tanlang:
  - **Rang mavzusi**: Kulrang, Moviy, Yashil yoki Toʻq sariq;
  - **Matn oʻlchami**: Oddiy yoki Yirik;
  - **Demo rejim**.
- **Demo rejim** har bir foydalanuvchi uchun alohida yoqiladi. Unda faqat demo maʼlumotlar koʻrinadi, sariq bannerda esa **Demo rejimdan chiqish** tugmasi boʻladi.
- Demo qatorlar hech qachon haqiqiy roʻyxatlar, jamlar, eksportlar yoki kundalik vazifalarga kirmaydi. Demo va haqiqiy yozuvlar oʻrtasidagi bogʻlanish qabul qilinmaydi.

## 5. Yodda tuting

- Xodimlarni oʻchirish oʻrniga nofaol qiling.
- SI kaliti faqat server sirlarida saqlanadi. Ilova faqat SI ni yoqadi yoki oʻchiradi.
- Yuklangan borderolar va ularning qatorlari hech qachon tahrirlanmaydi va oʻchirilmaydi. Demo borderolarni faqat **Barcha demo ma'lumotlarni o'chirish** oʻchiradi.
- Zaxiralar va qoplamalar faqat qoʻshib boriladi. Hisobdan chiqarishda kim, qachon va nima sababdan bajargani saqlanadi.
