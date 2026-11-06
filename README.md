# Desenci

Plazma (ya da lazer) kesim için **desenli sac panel** tasarlama programı: cam korkuluk, balkon korkuluğu, paravan, bahçe kapısı paneli, duvar / tavan paneli.

Panel ölçüsünü girersiniz, desen seçersiniz; program deseni o ölçüye karo karo yerleştirir. Kaydırıcılarla yatay / dikey karo sayısını, çubuk kalınlığını, çerçeveyi ve desenin kendi oranını değiştirip anında görürsünüz. Sonuç plazma makinesinin programına (SheetCam, FastCAM, Mach3 / CAM yazılımı…) verilecek **DXF** dosyasıdır.

## Kullanım

`release/Desenci.html` dosyasına **çift tıklayın**. Kurulum ve internet gerekmez; Windows, Mac, Linux ve tablette her güncel tarayıcıda (Edge, Chrome, Firefox, Safari) açılır. Dosyayı USB bellekle istediğiniz bilgisayara götürebilirsiniz.

1. **Panel ölçüsü:** genişlik, yükseklik (mm) ya da hazır ölçü; yan ve üst / alt çerçeve genişliği.
2. **Desen:** 111 hazır desen, gruplara göre süzülür:
   - **Madalyon / göbek (11):** kapı kanadı ya da panel ortasında tek büyük motif, çevresi boş, dört kolla çerçeveye bağlı. Dış biçim: daire, sekizgen, sekiz ve on iki kollu yıldız, dört yaprak, baklava, sivri kemer, kare (göbek kareyi doldurur). **On kollu gül:** ongen ve beşgenlerden kurulan, ortada on kollu, çevresinde beş kollu yıldızlı gül (yıldız açısı ve kol aralığı ayarlı). İçi 8 dolgudan biri (Selçuklu sekiz kollu yıldız, on iki kollu yıldız, Osmanlı altı kollu yıldız, Kahire, çiçek rozeti, kafes, yıldız ve haç, sekiz kollu gül); **dolgu sıklığı** ayarlanır. Ayrıca çizgi yıldız madalyonları (5–16 kol).
   - **Selçuklu / Osmanlı (32):** sekiz, on ve on iki kollu yıldızlar, güller ve rozetler, altı kollu yıldız ağları, Kahire yıldızı, kıvrık kare, uçurtma ve kuşak yıldızları, Kaşan yıldız ve haç, yıldız madalyonları. Yıldız desenleri Hankin'in "temas eden çokgenler" yöntemiyle 17 farklı döşemeden (düzgün çokgenli döşemeler ve eşlenikleri) kurulur. Her yıldızda iki ayar var: **yıldız açısı** (sivri / dolgun yıldız) ve **kol aralığı** (yıldız uçları kesik, kolları çift çizgili). Bu ikisiyle her desenden yüzlerce çeşit çıkar. Madalyonda kol sayısı (5–16) ve sivrilik seçilir.
   - **Roma / Yunan:** menderes, balık pulu, zincir, örgü (gülaçi), pelta, kesişen daireler, sekizgen ve kare, Kahire döşemesi, sarmal.
   - **Ferforje:** kapsül halkalı balkon korkuluğu (iç içe oval halkalar, ortada göbek, isteğe bağlı çapraz kafesli üst kuşak), ferforje pencere (dik çubuklar ve kıvrım kuşağı; kuşak yeri ve kıvrım boyu ayarlı), halkalı kıvrım, bulut kıvrımı (sıklık ve çeşit ayarlı), ferforje kıvrım, S kıvrım, kalp kıvrım, kıvrım çarkı. Bu desenler karonun gerçek oranına göre çizilir; karo uzasa da daireler ve kıvrımlar bozulmaz.
   - **Klasik:** soğan kemer (ogee) kafes, baklavalı yıldız, yuvarlak ve sivri kemer, gotik dört yaprak, rozet, hayat çiçeği, on ikigen ağ, küp kutusu.
   - **Modern:** organik hücre (Voronoi), petek, üçgen ağ, kagome, kenevir yaprağı, ritim çubukları, bambu, balıksırtı, gün doğumu, halkalar, şaşırtmalı ve geçişli delik.
   - **Kafes, Çizgi, Daire, Yarık / delik:** Çin kafesi tarzı kare desenler, çubuklar, ızgara, hasır, tuğla, dalga, halka, yarık ve delikler.

   Desenin kendi ayarları (ör. yıldız açısı, iç kare boyu, çubuk sayısı; organik hücrede sıklık ve çeşit), çubuk kalınlığı, döndürme, bir atlayarak aynalama. Kesintisiz desenler (yıldızlar, petek…) seçilince karo arası 0 olur, panel tek parça desen gibi görünür.
3. **Desenlerim (kendi deseniniz):**
   - **Çiz:** ızgaralı çizim alanında çizgi, dolu şekil ve daire çizin. Simetri seçeneği (ayna, dört yöne, sekiz yönlü yıldız) çiziminizi çoğaltır. Desen türü "çubuk" (çizgiler metal) ya da "yarık" (çizgiler kesik) olabilir; ön izleme düşen parçaları kırmızı gösterir.
   - **SVG / DXF al:** internetten indirdiğiniz hazır kesim dosyasını ya da çizim programından aldığınız çizimi desen yapın. "Kesim çizgisi" seçilirse kapalı şekiller boşluk olur, dosyadaki panelin dış kenarı atılır.
   - Desenler tarayıcıda saklanır; **Yedekle / Yedekten yükle** ile dosyaya alınır. Proje dosyası kullandığı deseni içinde taşır, başka bilgisayarda da açılır.
4. **Yerleşim:** yatay ve dikey karo sayısı (kaydırıcı), "karolar desenin oranında olsun" (dikey adet kendiliğinden; altıgen desenlerde karo dikdörtgen olur), karo arası şerit. Karo arası 0 olunca desenler birleşip tek parça desen olur.
5. **Kenar işlemi (büküm / geçme):** her kenar (üst, alt, sol, sağ) için ayrı seçilir:
   - **Büküm arkaya / öne:** kenara abkantta 90° bükülecek kanat eklenir. Panel en × boy bükümden sonraki dış ölçüdür, kanat yüksekliği de dış ölçüdür; açınım (düz sac) büküm payıyla hesaplanır: BA = π/2 · (r + K·t), büküm payı = 2·(r + t) − BA. İç büküm yarıçapı ve K katsayısı ayarlanır (yarıçap genelde sac kalınlığı, K 0,40–0,45). İki komşu kenar bükülünce köşeye **köşe boşaltması** açılır. **Büküm çizgisi** DXF'te ayrı katmandadır (BUKUM_ARKAYA / BUKUM_ONE, kesilmez); uçlarına isteğe bağlı küçük **işaret çentiği** kesilir. Kısa kanat ve desene çok yakın büküm için uyarı verir.
   - **Geçmeli şerit:** kenara dik oturan ayrı çerçeve şeridi. Şeridin altında **dişler**, panelde onlara uyan **yuvalar** kesilir (diş boyu, en çok diş aralığı, yuva payı ayarlanır). Varsayılan olarak şerit panelin dış kenarıyla aynı hizadadır (kenardan uzaklık 0); yuvalar kenardan açık çentik olur. Uzaklık verilirse şerit içeri alınır, yuvalar kapalı delik olur. Yatay şeritler köşede öne geçer, dikeyler onlara dayanır. Şeritler kesim dosyasında panelin altına dizilir (PARCA katmanı).
6. **Kesim ayarları:** sac kalınlığı, köşe yuvarlatma (boşluk köşeleri ve boşluğa giren sivri metal uçlar; ince metali eritmesin diye çubuk yarı kalınlığıyla sınırlı), en dar boşluk (bundan dar boşluk kesilmez), kesim hızı ve delme süresi (süre tahmini için).
7. **Bağlantı delikleri:** çerçeveye vida / cıvata deliği (çap, en çok aralık).
8. **Çıktı:** DXF (kesim), SVG (kesim çizgileri), Resim (müşteriye göstermek için PNG). **Kaydet / Aç** ile tasarım `.desenci.json` dosyası olarak saklanır; son tasarım tarayıcıda da kendiliğinden kalır.

Sağ tarafta boşluk sayısı, açıklık oranı, ağırlık (çelik), kesim boyu, delme sayısı ve tahmini süre görünür; panel adedi girilince toplamlar da çıkar.

### Uyarılar

- **Düşen parça:** boşluğun ortasında kalan, hiçbir yere bağlı olmayan metal kesilince düşer; program bunu kırmızıyla gösterir ve uyarır.
- **İnce çubuk:** çubuk sac kalınlığından inceyse plazmada eriyip eğilebilir.
- **Küçük boşluk:** en dar boşluk ayarından dar boşluklar kesilmez, metal kalır.

### DXF dosyası

- Ölçüler mm, panelin sol alt köşesi 0,0.
- Her kontur kapalı çoklu çizgi (POLYLINE, R12; bütün CAM programları okur).
- Katmanlar: `DIS_KONTUR` (dış kenar), `IC_KONTUR` (boşluklar), `BAGLANTI_DELIGI`, `DUSEN_PARCA`.
- Kesim sırası içten dışa: önce boşluklar, en son dış kenar (parça yerinden oynamasın).

## Geliştirme

- `npm install`, sonra `npm run dev` (geliştirme sunucusu)
- `npm test` (Vitest), `npx tsc -b`, `npm run lint`
- `npm run build`: `release/Desenci.html` tek dosyasını üretir (`scripts/build-web.cjs` Vite çıktısını tek HTML'e gömer)

React 19 + TypeScript + Vite + Tailwind 4, durum Zustand, geometri [clipper-lib](https://github.com/junmer/clipper-lib) (birleştirme, kırpma, kalınlaştırma).
