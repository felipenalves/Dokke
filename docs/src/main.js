import "./style.css";

const downloads = {
  mac: "https://github.com/felipenalves/Dokke/releases/latest/download/Dokke-macOS.dmg",
  android: "https://github.com/felipenalves/Dokke/releases/latest/download/dokke.apk",
};
const communityUrl = "https://documenteclub.vercel.app/";
const dokkeIcon = `${import.meta.env.BASE_URL}dokke-icon.png`;

const patternLine = "> > > 0 0 1 0 > > 0 0 0 > > > 1 0 0 > 0 1 0 > > > 0 0";
const pattern = Array.from({ length: 15 }, (_, index) => {
  const offset = index % 3;
  return `<span style="--offset: ${offset}ch">${patternLine} ${patternLine}</span>`;
}).join("");

const i18n = {
  "pt": {
    navFeatures: "Recursos",
    navCommunity: "Comunidade",
    navDocs: "Docs",
    docsUrl: "https://github.com/felipenalves/Dokke#leia-me-primeiro",
    heroEyebrow: "DOKKE · SEU MAC, EM QUALQUER TELA",
    heroTitle: "Os apps do seu Mac.<br /><em>Em qualquer tela.</em>",
    heroCopy: "Fixe no Mac. Abra no Android, iPhone ou navegador — na mesma rede, sem conta.",
    downloadMac: "Baixar para macOS",
    downloadAndroid: "Baixar para Android",
    heroMeta: "macOS 14+ · Android · iPhone via PWA · grátis",
    windowsSoonBadge: "Em breve",
    windowsSoonText: "Dokke para Windows",

    featuresKicker: "02 / o que tem no dokke",
    featuresTitle: "O dock do seu Mac,<br /><em>sem ficar preso ao Mac.</em>",
    f1Title: "Acesse o que já está no seu Mac.",
    f1Text: "Fixe os apps uma vez. Abra pelo Android, iPhone ou navegador na mesma rede.",
    f2Title: "Sem conta. Sem nuvem.",
    f2Text: "O Dokke conecta seus dispositivos diretamente. Menos cadastro, menos coisa para configurar.",
    f3Title: "Do download ao primeiro toque.",
    f3Text: "Baixe o DMG, arraste para Aplicativos e escolha seus apps. O celular encontra o Mac sozinho.",
    f3P1: "PIN de acesso",
    f3P2: "Tempo real",
    f3P3: "APK + PWA",
    f3P4: "MIT",

    roadmapKicker: "03 / próximos capítulos",
    roadmapTitle: "O que vem<br /><em>depois.</em>",
    roadmapIntro: "O que já existe está marcado. O resto são os próximos atalhos para deixar o Mac ainda mais acessível.",
    roadmapBadge: "disponível agora · v0.2.7",
    statusAvailable: "já existe",
    statusSpoiler: "spoiler",
    r1Title: "Alternar entre os aplicativos abertos",
    r1Text: "Veja o que está rodando no Mac e troque de app direto pelo dock.",
    r2Title: "Controlar o OBS Studio",
    r2Text: "Mude a cena, inicie ou pare a gravação e acompanhe a live sem sair do celular.",
    r3Title: "Volume e mídia",
    r3Text: "Aumente, reduza, pause e continue o que está tocando no Mac.",
    r4Title: "Um teclado só de emoji",
    r4Text: "Puxe a mesma ideia da tecla de emoji do Mac para responder, criar e compartilhar sem trocar de tela.",
    r5Title: "Crie todos os seus fluxos de trabalho ✨",
    r5Text: "Conecte o Dokke ao Apple Shortcuts e transforme ações repetidas em um toque.",

    communityKicker: "04 / construção em comunidade",
    communityTitle: "O próximo atalho<br /><em>pode vir de você.</em>",
    communityIntro: "O Dokke é construído em comunidade. Encontrou um bug, teve uma ideia ou quer ajudar? Comente no GitHub — é lá que o projeto é analisado e evolui.",
    communityCta: "Comentar no GitHub",
    bugLabel: "BUG",
    bugTitle: "Encontrou um problema?",
    bugText: "Abra uma Issue e conte a versão, o dispositivo e os passos para reproduzir.",
    ideaLabel: "IDEIA",
    ideaTitle: "Imaginou uma feature?",
    ideaText: "Abra uma Discussion em Ideas. O que a comunidade pedir pode virar o próximo lançamento.",
    helpLabel: "AJUDA",
    helpTitle: "Quer construir junto?",
    helpText: "Leia como contribuir, testar e manter cada mudança pequena e útil.",
    clubKicker: "Outro produto · Documente Club",
    clubTitle: "IA aplicada para quem está construindo.",
    clubText: "Uma comunidade paga para builders, entusiastas de IA e solo founders que querem implementar IA de verdade em projetos e negócios.",
    clubCta: "Conhecer o Documente Club",

    faqKicker: "05 / perguntas frequentes",
    faqTitle: "Antes de instalar,<br /><em>sem surpresa.</em>",
    q1: "Preciso instalar Node.js?",
    a1: "Não para usar o DMG. O Node já vem embutido no Dokke para Mac. Ele só é necessário para quem quer rodar ou desenvolver pelo código.",
    q2: "O Mac e o celular precisam estar na mesma rede?",
    a2: "Sim. O Dokke é local-first: o Mac e o dispositivo precisam conseguir conversar pela mesma rede Wi-Fi ou LAN.",
    q3: "Como acesso pelo iPhone?",
    a3: "Abra no Safari o endereço mostrado pelo Dokke e, se quiser, use Adicionar à Tela de Início. O iPhone funciona como PWA.",
    q4: "O Dokke envia meus dados para a nuvem?",
    a4: "Não. O Mac conversa diretamente com os dispositivos na sua rede local. O Dokke não precisa de conta ou servidor externo.",
    q5: "O que faço se o macOS bloquear o app?",
    a5: "Clique com o botão direito no <b>Dokke.app</b>, escolha <b>Abrir</b> e confirme. Se essa opção não aparecer, abra <b>Ajustes do Sistema → Privacidade e Segurança → Segurança → Abrir Mesmo Assim → Abrir</b>. Esse aviso pode aparecer porque o Dokke é distribuído fora da App Store.",
    q6: "Já existe uma versão para Windows?",
    a6: "Ainda não. A primeira release pública é para macOS, com Android e PWA como clientes. Windows está planejado para uma próxima etapa.",

    footerNote: "© 2026 Dokke · um produto de Felipe Natanael"
  },
  "en": {
    navFeatures: "Features",
    navCommunity: "Community",
    navDocs: "Docs",
    docsUrl: "https://github.com/felipenalves/Dokke/blob/main/README.en.md#read-me-first",
    heroEyebrow: "DOKKE · YOUR MAC, ON ANY SCREEN",
    heroTitle: "Your Mac apps.<br /><em>On any screen.</em>",
    heroCopy: "Pin on Mac. Open on Android, iPhone, or browser — on the same local network, no account needed.",
    downloadMac: "Download for macOS",
    downloadAndroid: "Download for Android",
    heroMeta: "macOS 14+ · Android · iPhone via PWA · free",
    windowsSoonBadge: "Coming soon",
    windowsSoonText: "Dokke for Windows",

    featuresKicker: "02 / what's in dokke",
    featuresTitle: "Your Mac's dock,<br /><em>without being tied to your Mac.</em>",
    f1Title: "Access what is already on your Mac.",
    f1Text: "Pin apps once. Launch from Android, iPhone, or browser on the same Wi-Fi network.",
    f2Title: "No account. No cloud.",
    f2Text: "Dokke connects your devices directly. Zero sign-up, minimal configuration.",
    f3Title: "From download to first tap.",
    f3Text: "Download the DMG, drag to Applications, and pick your apps. Your phone finds your Mac automatically.",
    f3P1: "Access PIN",
    f3P2: "Real-time",
    f3P3: "APK + PWA",
    f3P4: "MIT",

    roadmapKicker: "03 / roadmap",
    roadmapTitle: "What comes<br /><em>next.</em>",
    roadmapIntro: "Shipped features are marked. The rest are upcoming shortcuts to make your Mac even more accessible.",
    roadmapBadge: "available now · v0.2.7",
    statusAvailable: "available",
    statusSpoiler: "upcoming",
    r1Title: "Switch between running apps",
    r1Text: "See what is running on your Mac and switch active apps directly from the mobile dock.",
    r2Title: "Control OBS Studio",
    r2Text: "Switch scenes, start/stop recordings and stream live without touching your keyboard.",
    r3Title: "Volume and media controls",
    r3Text: "Adjust volume, pause, resume, and skip media currently playing on your Mac.",
    r4Title: "Dedicated emoji keyboard",
    r4Text: "Quickly access Mac emoji picker to reply, create, and share without switching apps.",
    r5Title: "Create custom workflows ✨",
    r5Text: "Connect Dokke with Apple Shortcuts to trigger complex workflows with a single tap.",

    communityKicker: "04 / built with community",
    communityTitle: "The next shortcut<br /><em>could come from you.</em>",
    communityIntro: "Dokke is open source and community-driven. Found a bug, have an idea, or want to contribute? Join the discussions on GitHub.",
    communityCta: "Comment on GitHub",
    bugLabel: "BUG",
    bugTitle: "Found a problem?",
    bugText: "Open an Issue with version details, device type, and reproduction steps.",
    ideaLabel: "IDEA",
    ideaTitle: "Have a feature request?",
    ideaText: "Start a Discussion under Ideas. Community requests directly shape upcoming releases.",
    helpLabel: "HELP",
    helpTitle: "Want to contribute?",
    helpText: "Read our contributing guide to build, test, and submit clean PRs.",
    clubKicker: "Another project · Documente Club",
    clubTitle: "Applied AI for builders.",
    clubText: "A premium community for builders, AI enthusiasts, and solo founders implementing production AI in real products.",
    clubCta: "Explore Documente Club",

    faqKicker: "05 / frequently asked questions",
    faqTitle: "Before installing,<br /><em>clear answers.</em>",
    q1: "Do I need to install Node.js?",
    a1: "Not if you use the DMG. Node.js is bundled with Dokke for Mac. It is only required for local source development.",
    q2: "Must the Mac and device be on the same network?",
    a2: "Yes. Dokke is local-first: your Mac and remote devices must be connected to the same Wi-Fi network or LAN.",
    q3: "How do I use it on iPhone?",
    a3: "Open the address shown in Dokke inside Safari, then tap 'Add to Home Screen'. iPhone works as a PWA.",
    q4: "Does Dokke send data to the cloud?",
    a4: "No. Your Mac communicates directly with devices over your local network. No accounts or external cloud servers are used.",
    q5: "What if macOS blocks the app?",
    a5: "Right-click <b>Dokke.app</b>, choose <b>Open</b>, and confirm. Alternatively, go to <b>System Settings → Privacy & Security → Security → Open Anyway</b>.",
    q6: "Is there a Windows version?",
    a6: "Not yet. The initial release supports macOS as host with Android and PWA as clients. Windows host is planned.",

    footerNote: "© 2026 Dokke · built by Felipe Natanael"
  }
};

function getLanguage() {
  try {
    const saved = localStorage.getItem("dokke_landing_lang");
    if (saved && (saved === "pt" || saved === "en")) return saved;
    const nav = (navigator.language || (navigator.languages && navigator.languages[0]) || "").toLowerCase();
    if (nav.startsWith("pt")) return "pt";
    return "en";
  } catch (e) {
    return "pt";
  }
}

let currentLang = getLanguage();

function render() {
  const t = i18n[currentLang] || i18n.pt;
  document.documentElement.lang = currentLang === "pt" ? "pt-BR" : "en";

  document.querySelector("#app").innerHTML = `
    <div class="hero-page" id="section-01">
      <div class="code-pattern" aria-hidden="true">${pattern}</div>

      <header class="site-header">
        <nav class="nav-shell" aria-label="Main Navigation">
          <a class="wordmark" href="#section-01" aria-label="Dokke Home">Dokke</a>
          <div class="nav-links">
            <a href="#features">${t.navFeatures}</a>
            <a href="#community">${t.navCommunity}</a>
            <a href="${t.docsUrl}">${t.navDocs}</a>
            <a href="https://github.com/felipenalves/Dokke">GitHub</a>
          </div>
          <div class="nav-actions">
            <div class="docs-lang-toggle" aria-label="Language selection">
              <button type="button" class="docs-lang-btn ${currentLang === "pt" ? "active" : ""}" data-setlang="pt">PT</button>
              <button type="button" class="docs-lang-btn ${currentLang === "en" ? "active" : ""}" data-setlang="en">EN</button>
            </div>
            <a class="github-link" href="https://github.com/felipenalves/Dokke" target="_blank" rel="noreferrer">
              <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" fill="currentColor"/></svg>
              <span>GitHub</span>
            </a>
          </div>
        </nav>
      </header>

      <main>
        <section class="hero" aria-labelledby="hero-title">
          <div class="hero-emblem" aria-hidden="true">
            <img class="hero-icon" src="${dokkeIcon}" alt="" />
          </div>

          <p class="eyebrow">${t.heroEyebrow}</p>
          <h1 id="hero-title">${t.heroTitle}</h1>
          <p class="hero-copy">${t.heroCopy}</p>
          <div class="hero-actions">
            <a class="primary-button" href="${downloads.mac}">
              <svg class="platform-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" fill="currentColor"/></svg>
              <span>${t.downloadMac}</span>
            </a>
            <span class="cta-plus" aria-hidden="true">+</span>
            <a class="primary-button primary-button--android" href="${downloads.android}">
              <svg class="platform-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.4395 5.5586c-.675 1.1664-1.352 2.3318-2.0274 3.498-.0366-.0155-.0742-.0286-.1113-.043-1.8249-.6957-3.484-.8-4.42-.787-1.8551.0185-3.3544.4643-4.2597.8203-.084-.1494-1.7526-3.021-2.0215-3.4864a1.1451 1.1451 0 0 0-.1406-.1914c-.3312-.364-.9054-.4859-1.379-.203-.475.282-.7136.9361-.3886 1.5019 1.9466 3.3696-.0966-.2158 1.9473 3.3593.0172.031-.4946.2642-1.3926 1.0177C2.8987 12.176.452 14.772 0 18.9902h24c-.119-1.1108-.3686-2.099-.7461-3.0683-.7438-1.9118-1.8435-3.2928-2.7402-4.1836a12.1048 12.1048 0 0 0-2.1309-1.6875c.6594-1.122 1.312-2.2559 1.9649-3.3848.2077-.3615.1886-.7956-.0079-1.1191a1.1001 1.1001 0 0 0-.8515-.5332c-.5225-.0536-.9392.3128-1.0488.5449zm-.0391 8.461c.3944.5926.324 1.3306-.1563 1.6503-.4799.3197-1.188.0985-1.582-.4941-.3944-.5927-.324-1.3307.1563-1.6504.4727-.315 1.1812-.1086 1.582.4941zM7.207 13.5273c.4803.3192.5503 1.0577.1563 1.6504-.394.5927-1.1038.8138-1.584.4941-.48-.3197-.5507-1.0577-.1563-1.6504.4008-.6021 1.1087-.8106 1.584-.4941z" fill="currentColor"/></svg>
              <span>${t.downloadAndroid}</span>
            </a>
          </div>
          <p class="hero-meta">${t.heroMeta}</p>
          <p class="windows-note"><span>${t.windowsSoonBadge}</span> ${t.windowsSoonText}</p>
        </section>
      </main>

    </div>

    <section class="features-section" id="features" aria-labelledby="features-title">
      <div class="section-shell">
        <header class="section-heading">
          <p class="section-kicker">${t.featuresKicker}</p>
          <h2 id="features-title">${t.featuresTitle}</h2>
        </header>

        <div class="features-grid">
          <article class="feature-card feature-card--dark">
            <span class="feature-index">01</span>
            <h3>${t.f1Title}</h3>
            <p>${t.f1Text}</p>
            <div class="feature-points feature-points--dark"><span>Mac host</span><span>Android</span><span>PWA</span></div>
          </article>

          <article class="feature-card">
            <span class="feature-index">02</span>
            <h3>${t.f2Title}</h3>
            <p>${t.f2Text}</p>
            <div class="feature-line"></div>
          </article>

          <article class="feature-card feature-card--wide">
            <div>
              <span class="feature-index">03</span>
              <h3>${t.f3Title}</h3>
              <p>${t.f3Text}</p>
            </div>
            <div class="feature-points"><span>${t.f3P1}</span><span>${t.f3P2}</span><span>${t.f3P3}</span><span>${t.f3P4}</span></div>
          </article>
        </div>
      </div>
    </section>

    <section class="roadmap-section" id="roadmap" aria-labelledby="roadmap-title">
      <div class="section-shell roadmap-shell">
        <header class="roadmap-heading">
          <p class="section-kicker">${t.roadmapKicker}</p>
          <h2 id="roadmap-title">${t.roadmapTitle}</h2>
          <p class="roadmap-intro">${t.roadmapIntro}</p>
          <div class="version-badge"><span></span> ${t.roadmapBadge}</div>
        </header>

        <div class="roadmap-list">
          <article class="roadmap-item roadmap-item--available">
            <span class="roadmap-status">${t.statusAvailable}</span>
            <div><h3>${t.r1Title}</h3><p>${t.r1Text}</p></div>
          </article>
          <article class="roadmap-item">
            <span class="roadmap-status">${t.statusSpoiler}</span>
            <div><h3>${t.r2Title}</h3><p>${t.r2Text}</p></div>
          </article>
          <article class="roadmap-item">
            <span class="roadmap-status">${t.statusSpoiler}</span>
            <div><h3>${t.r3Title}</h3><p>${t.r3Text}</p></div>
          </article>
          <article class="roadmap-item">
            <span class="roadmap-status">${t.statusSpoiler}</span>
            <div><h3>${t.r4Title}</h3><p>${t.r4Text}</p></div>
          </article>
          <article class="roadmap-item">
            <span class="roadmap-status">${t.statusSpoiler}</span>
            <div><h3>${t.r5Title}</h3><p>${t.r5Text}</p></div>
          </article>
        </div>
      </div>
    </section>

    <section class="community-section" id="community" aria-labelledby="community-title">
      <div class="section-shell community-shell">
        <header class="community-heading">
          <p class="section-kicker">${t.communityKicker}</p>
          <h2 id="community-title">${t.communityTitle}</h2>
          <p class="community-intro">${t.communityIntro}</p>
          <a class="community-cta" href="https://github.com/felipenalves/Dokke/discussions" target="_blank" rel="noreferrer">${t.communityCta} <span aria-hidden="true">↗</span></a>
        </header>

        <div class="community-actions" aria-label="How to contribute">
          <a class="community-action" href="https://github.com/felipenalves/Dokke/issues/new?template=bug_report.yml" target="_blank" rel="noreferrer">
            <span class="community-action-type">${t.bugLabel}</span>
            <div><h3>${t.bugTitle}</h3><p>${t.bugText}</p></div>
            <span class="community-action-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="community-action" href="https://github.com/felipenalves/Dokke/discussions/categories/ideas" target="_blank" rel="noreferrer">
            <span class="community-action-type">${t.ideaLabel}</span>
            <div><h3>${t.ideaTitle}</h3><p>${t.ideaText}</p></div>
            <span class="community-action-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="community-action" href="https://github.com/felipenalves/Dokke/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer">
            <span class="community-action-type">${t.helpLabel}</span>
            <div><h3>${t.helpTitle}</h3><p>${t.helpText}</p></div>
            <span class="community-action-arrow" aria-hidden="true">↗</span>
          </a>

          <aside class="community-club">
            <p class="community-club-kicker">${t.clubKicker}</p>
            <h3>${t.clubTitle}</h3>
            <p>${t.clubText}</p>
            <a class="community-club-cta" href="${communityUrl}" target="_blank" rel="noreferrer">${t.clubCta} <span aria-hidden="true">↗</span></a>
          </aside>
        </div>
      </div>
    </section>

    <section class="faq-section" id="faq" aria-labelledby="faq-title">
      <div class="section-shell faq-shell">
        <header class="faq-heading">
          <p class="section-kicker">${t.faqKicker}</p>
          <h2 id="faq-title">${t.faqTitle}</h2>
        </header>

        <div class="faq-list">
          <details>
            <summary>${t.q1}</summary>
            <p>${t.a1}</p>
          </details>
          <details>
            <summary>${t.q2}</summary>
            <p>${t.a2}</p>
          </details>
          <details>
            <summary>${t.q3}</summary>
            <p>${t.a3}</p>
          </details>
          <details>
            <summary>${t.q4}</summary>
            <p>${t.a4}</p>
          </details>
          <details>
            <summary>${t.q5}</summary>
            <p>${t.a5}</p>
          </details>
          <details>
            <summary>${t.q6}</summary>
            <p>${t.a6}</p>
          </details>
        </div>
      </div>
    </section>

    <footer class="site-footer">
      <a class="footer-brand" href="#section-01" aria-label="Back to top">Dokke</a>
      <p class="footer-note">${t.footerNote}</p>
      <nav class="footer-links" aria-label="Social links">
        <a href="https://instagram.com/felipenalves" target="_blank" rel="noreferrer">Instagram</a>
        <a href="https://x.com/felipenalves" target="_blank" rel="noreferrer">X</a>
        <a href="https://github.com/felipenalves/Dokke" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </footer>
  `;

  document.querySelectorAll("[data-setlang]").forEach(btn => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-setlang");
      if (lang && lang !== currentLang) {
        currentLang = lang;
        try { localStorage.setItem("dokke_landing_lang", lang); } catch (e) {}
        render();
      }
    });
  });
}

render();
