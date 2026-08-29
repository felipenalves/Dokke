import "./style.css";

const downloads = {
  mac: "https://github.com/felipenalves/Dokke/releases/latest/download/Dokke-macOS.dmg",
  android: "https://github.com/felipenalves/Dokke/releases/latest/download/dokke.apk",
};
const communityUrl = "https://documenteclub.vercel.app/";
const dokkeHeroIcon = `${import.meta.env.BASE_URL}dokke-hero.webp`;

const patternLine = "> > > 0 0 1 0 > > 0 0 0 > > > 1 0 0 > 0 1 0 > > > 0 0";
const pattern = Array.from({ length: 15 }, (_, index) => {
  const offset = index % 3;
  return `<span style="--offset: ${offset}ch">${patternLine} ${patternLine}</span>`;
}).join("");

const LANDING_LANGUAGE_KEY = "dokke_landing_lang";
const LANDING_COPY = {
  "pt-BR": {
    "aria.language": "Idioma", "nav.aria": "Navegação principal", "nav.features": "Recursos", "nav.community": "Comunidade", "nav.docs": "Docs", "nav.github": "GitHub",
    "hero.aria": "Pressionar o ícone do Dokke", "hero.eyebrow": "DOKKE · SEU MAC, EM QUALQUER TELA", "hero.title": "Os apps do seu Mac.<br /><em>Em qualquer tela.</em>", "hero.copy": "Fixe no Mac. Abra no Android, iPhone ou navegador — na mesma rede, sem conta.", "hero.mac": "Baixar para macOS", "hero.android": "Baixar para Android", "hero.meta": "macOS 14+ · Android · iPhone via PWA · grátis", "hero.windows": "Em breve|Dokke para Windows",
    "features.kicker": "02 / o que tem no dokke", "features.title": "O dock do seu Mac,<br /><em>sem ficar preso ao Mac.</em>", "feature.1.title": "Acesse o que já está no seu Mac.", "feature.1.copy": "Fixe os apps uma vez. Abra pelo Android, iPhone ou navegador na mesma rede.", "feature.2.title": "Sem conta. Sem nuvem.", "feature.2.copy": "O Dokke conecta seus dispositivos diretamente. Menos cadastro, menos coisa para configurar.", "feature.3.title": "Do download ao primeiro toque.", "feature.3.copy": "Baixe o DMG, arraste para Aplicativos e escolha seus apps. O celular encontra o Mac sozinho.", "feature.3.points": "PIN de acesso|Tempo real|APK + PWA|MIT",
    "roadmap.kicker": "03 / próximos capítulos", "roadmap.title": "O que vem<br /><em>depois.</em>", "roadmap.intro": "O que já existe está marcado. O resto são os próximos atalhos para deixar o Mac ainda mais acessível.", "roadmap.available": "disponível agora", "roadmap.exists": "já existe", "roadmap.1.title": "Alternar entre os aplicativos abertos", "roadmap.1.copy": "Veja o que está rodando no Mac e troque de app direto pelo dock.", "roadmap.2.title": "Controlar o OBS Studio", "roadmap.2.copy": "Mude a cena, inicie ou pare a gravação e acompanhe a live sem sair do celular.", "roadmap.3.title": "Volume e mídia", "roadmap.3.copy": "Aumente, reduza, pause e continue o que está tocando no Mac.", "roadmap.4.title": "Um teclado só de emoji", "roadmap.4.copy": "Puxe a mesma ideia da tecla de emoji do Mac para responder, criar e compartilhar sem trocar de tela.", "roadmap.5.title": "Crie todos os seus fluxos de trabalho ✨", "roadmap.5.copy": "Conecte o Dokke ao Apple Shortcuts e transforme ações repetidas em um toque.",
    "community.kicker": "04 / construção em comunidade", "community.title": "O próximo atalho<br /><em>pode vir de você.</em>", "community.intro": "O Dokke é construído em comunidade. Encontrou um bug, teve uma ideia ou quer ajudar? Comente no GitHub — é lá que o projeto é analisado e evolui.", "community.cta": "Comentar no GitHub", "community.aria": "Como contribuir com o Dokke", "community.1.title": "Encontrou um problema?", "community.1.copy": "Abra uma Issue e conte a versão, o dispositivo e os passos para reproduzir.", "community.2.title": "Imaginou uma feature?", "community.2.copy": "Abra uma Discussion em Ideas. O que a comunidade pedir pode virar o próximo lançamento.", "community.3.title": "Quer construir junto?", "community.3.copy": "Leia como contribuir, testar e manter cada mudança pequena e útil.", "club.kicker": "Outro produto · Documente Club", "club.title": "IA aplicada para quem está construindo.", "club.copy": "Uma comunidade paga para builders, entusiastas de IA e solo founders que querem implementar IA de verdade em projetos e negócios.", "club.cta": "Conhecer o Documente Club",
    "faq.kicker": "05 / perguntas frequentes", "faq.title": "Antes de instalar,<br /><em>sem surpresa.</em>", "faq.1.q": "Preciso instalar Node.js?", "faq.1.a": "Não para usar o DMG. O Node já vem embutido no Dokke para Mac. Ele só é necessário para quem quer rodar ou desenvolver pelo código.", "faq.2.q": "O Mac e o celular precisam estar na mesma rede?", "faq.2.a": "Sim. O Dokke é local-first: o Mac e o dispositivo precisam conseguir conversar pela mesma rede Wi-Fi ou LAN.", "faq.3.q": "Como acesso pelo iPhone?", "faq.3.a": "Abra no Safari o endereço mostrado pelo Dokke e, se quiser, use Adicionar à Tela de Início. O iPhone funciona como PWA.", "faq.4.q": "O Dokke envia meus dados para a nuvem?", "faq.4.a": "Não. O Mac conversa diretamente com os dispositivos na sua rede local. O Dokke não precisa de conta ou servidor externo.", "faq.5.q": "O que faço se o macOS bloquear o app?", "faq.5.a": "Clique com o botão direito no Dokke.app, escolha Abrir e confirme. Se essa opção não aparecer, abra Ajustes do Sistema → Privacidade e Segurança → Segurança → Abrir Mesmo Assim → Abrir. Esse aviso pode aparecer porque o Dokke é distribuído fora da App Store.", "faq.6.q": "Já existe uma versão para Windows?", "faq.6.a": "Ainda não. A primeira release pública é para macOS, com Android e PWA como clientes. Windows está planejado para uma próxima etapa.", "footer.aria": "Links sociais", "footer.back": "Voltar ao início", "footer.note": "© 2026 Dokke · um produto de Felipe Natanael"
  },
  en: {
    "aria.language": "Language", "nav.aria": "Main navigation", "nav.features": "Features", "nav.community": "Community", "nav.docs": "Docs", "nav.github": "GitHub",
    "hero.aria": "Press the Dokke icon", "hero.eyebrow": "DOKKE · YOUR MAC, ON ANY SCREEN", "hero.title": "Your Mac apps.<br /><em>On any screen.</em>", "hero.copy": "Pin on your Mac. Open on Android, iPhone, or browser — on the same network, no account.", "hero.mac": "Download for macOS", "hero.android": "Download for Android", "hero.meta": "macOS 14+ · Android · iPhone via PWA · free", "hero.windows": "Coming soon|Dokke for Windows",
    "features.kicker": "02 / what dokke has", "features.title": "Your Mac dock,<br /><em>without being stuck to your Mac.</em>", "feature.1.title": "Access what's already on your Mac.", "feature.1.copy": "Pin your apps once. Open them from Android, iPhone, or a browser on the same network.", "feature.2.title": "No account. No cloud.", "feature.2.copy": "Dokke connects your devices directly. Less signup, less to configure.", "feature.3.title": "From download to first tap.", "feature.3.copy": "Download the DMG, drag it to Applications, and choose your apps. Your phone finds the Mac automatically.", "feature.3.points": "Access PIN|Real time|APK + PWA|MIT",
    "roadmap.kicker": "03 / what's next", "roadmap.title": "What comes<br /><em>next.</em>", "roadmap.intro": "What already exists is marked. The rest are the next shortcuts to make your Mac even more accessible.", "roadmap.available": "available now", "roadmap.exists": "available", "roadmap.1.title": "Switch between open apps", "roadmap.1.copy": "See what's running on your Mac and switch apps directly from the dock.", "roadmap.2.title": "Control OBS Studio", "roadmap.2.copy": "Change the scene, start or stop recording, and follow the live stream from your phone.", "roadmap.3.title": "Volume and media", "roadmap.3.copy": "Turn up, turn down, pause, and resume what's playing on your Mac.", "roadmap.4.title": "An emoji-only keyboard", "roadmap.4.copy": "Bring the Mac emoji key idea to replies, creation, and sharing without changing screens.", "roadmap.5.title": "Create all your workflows ✨", "roadmap.5.copy": "Connect Dokke to Apple Shortcuts and turn repeated actions into one tap.",
    "community.kicker": "04 / built in community", "community.title": "The next shortcut<br /><em>could come from you.</em>", "community.intro": "Dokke is built in community. Found a bug, have an idea, or want to help? Comment on GitHub — that's where the project is reviewed and evolves.", "community.cta": "Comment on GitHub", "community.aria": "How to contribute to Dokke", "community.1.title": "Found a problem?", "community.1.copy": "Open an Issue and share the version, device, and steps to reproduce it.", "community.2.title": "Imagined a feature?", "community.2.copy": "Open a Discussion in Ideas. What the community asks for could become the next release.", "community.3.title": "Want to build together?", "community.3.copy": "Read how to contribute, test, and keep every change small and useful.", "club.kicker": "Another product · Documente Club", "club.title": "Applied AI for people building.", "club.copy": "A paid community for builders, AI enthusiasts, and solo founders who want to implement AI for real in projects and businesses.", "club.cta": "Explore Documente Club",
    "faq.kicker": "05 / frequently asked questions", "faq.title": "Before you install,<br /><em>no surprises.</em>", "faq.1.q": "Do I need to install Node.js?", "faq.1.a": "Not to use the DMG. Node is bundled with Dokke for Mac. It is only needed if you want to run or develop from source.", "faq.2.q": "Do the Mac and phone need to be on the same network?", "faq.2.a": "Yes. Dokke is local-first: the Mac and device must be able to communicate over the same Wi-Fi or LAN.", "faq.3.q": "How do I access it from iPhone?", "faq.3.a": "Open the address shown by Dokke in Safari and, if you want, choose Add to Home Screen. iPhone works as a PWA.", "faq.4.q": "Does Dokke send my data to the cloud?", "faq.4.a": "No. Your Mac talks directly to devices on your local network. Dokke does not need an account or external server.", "faq.5.q": "What if macOS blocks the app?", "faq.5.a": "Right-click Dokke.app, choose Open, and confirm. If that option does not appear, open System Settings → Privacy & Security → Security → Open Anyway → Open. This may appear because Dokke is distributed outside the App Store.", "faq.6.q": "Is there a Windows version yet?", "faq.6.a": "Not yet. The first public release is for macOS, with Android and PWA as clients. Windows is planned for a later stage.", "footer.aria": "Social links", "footer.back": "Back to top", "footer.note": "© 2026 Dokke · a Felipe Natanael product"
  }
};

function detectLandingLanguage(language = navigator.language) {
  if (typeof language !== "string" || !language.trim()) return "pt-BR";
  return language.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
}

function getLandingLanguage() {
  try {
    const saved = localStorage.getItem(LANDING_LANGUAGE_KEY);
    if (saved === "pt-BR" || saved === "en") return saved;
  } catch {}
  return detectLandingLanguage();
}

let landingLanguage = getLandingLanguage();

document.querySelector("#app").innerHTML = `
  <div class="hero-page" id="section-01">
    <div class="code-pattern" aria-hidden="true">${pattern}</div>

    <header class="site-header">
      <nav class="nav-shell" aria-label="Navegação principal" data-i18n-aria="nav.aria">
        <a class="wordmark" href="#section-01" aria-label="Dokke início" data-i18n-aria="footer.back">Dokke</a>
        <div class="nav-links">
          <a href="#features">Recursos</a>
          <a href="#community">Comunidade</a>
          <a href="https://github.com/felipenalves/Dokke#leia-me-primeiro">Docs</a>
          <a href="https://github.com/felipenalves/Dokke">GitHub</a>
        </div>
        <div class="nav-actions">
        <div class="language-toggle" data-language-toggle aria-label="Idioma" data-i18n-aria="aria.language">
          <button type="button" data-language="pt-BR" aria-pressed="true">PT</button>
          <button type="button" data-language="en" aria-pressed="false">EN</button>
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
        <button type="button" class="hero-emblem" aria-label="Pressionar o ícone do Dokke" data-i18n-aria="hero.aria">
          <img class="hero-icon" src="${dokkeHeroIcon}" alt="" />
        </button>

        <p class="eyebrow">DOKKE · SEU MAC, EM QUALQUER TELA</p>
        <h1 id="hero-title">Os apps do seu Mac.<br /><em>Em qualquer tela.</em></h1>
        <p class="hero-copy">Fixe no Mac. Abra no Android, iPhone ou navegador — na mesma rede, sem conta.</p>
        <div class="hero-actions">
          <a class="primary-button" href="${downloads.mac}">
            <svg class="platform-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" fill="currentColor"/></svg>
            <span>Baixar para macOS</span>
          </a>
          <span class="cta-plus" aria-hidden="true">+</span>
          <a class="primary-button primary-button--android" href="${downloads.android}">
            <svg class="platform-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.4395 5.5586c-.675 1.1664-1.352 2.3318-2.0274 3.498-.0366-.0155-.0742-.0286-.1113-.043-1.8249-.6957-3.484-.8-4.42-.787-1.8551.0185-3.3544.4643-4.2597.8203-.084-.1494-1.7526-3.021-2.0215-3.4864a1.1451 1.1451 0 0 0-.1406-.1914c-.3312-.364-.9054-.4859-1.379-.203-.475.282-.7136.9361-.3886 1.5019 1.9466 3.3696-.0966-.2158 1.9473 3.3593.0172.031-.4946.2642-1.3926 1.0177C2.8987 12.176.452 14.772 0 18.9902h24c-.119-1.1108-.3686-2.099-.7461-3.0683-.7438-1.9118-1.8435-3.2928-2.7402-4.1836a12.1048 12.1048 0 0 0-2.1309-1.6875c.6594-1.122 1.312-2.2559 1.9649-3.3848.2077-.3615.1886-.7956-.0079-1.1191a1.1001 1.1001 0 0 0-.8515-.5332c-.5225-.0536-.9392.3128-1.0488.5449zm-.0391 8.461c.3944.5926.324 1.3306-.1563 1.6503-.4799.3197-1.188.0985-1.582-.4941-.3944-.5927-.324-1.3307.1563-1.6504.4727-.315 1.1812-.1086 1.582.4941zM7.207 13.5273c.4803.3192.5503 1.0577.1563 1.6504-.394.5927-1.1038.8138-1.584.4941-.48-.3197-.5507-1.0577-.1563-1.6504.4008-.6021 1.1087-.8106 1.584-.4941z" fill="currentColor"/></svg>
            <span>Baixar para Android</span>
          </a>
        </div>
        <p class="hero-meta">macOS 14+ · Android · iPhone via PWA · grátis</p>
        <p class="windows-note"><span>Em breve</span> Dokke para Windows</p>
      </section>
    </main>

  </div>

  <section class="features-section" id="features" aria-labelledby="features-title">
    <div class="section-shell">
      <header class="section-heading">
        <p class="section-kicker">02 / o que tem no dokke</p>
        <h2 id="features-title">O dock do seu Mac,<br /><em>sem ficar preso ao Mac.</em></h2>
      </header>

      <div class="features-grid">
        <article class="feature-card feature-card--dark">
          <span class="feature-index">01</span>
          <h3>Acesse o que já está no seu Mac.</h3>
          <p>Fixe os apps uma vez. Abra pelo Android, iPhone ou navegador na mesma rede.</p>
          <div class="feature-points feature-points--dark"><span>Mac host</span><span>Android</span><span>PWA</span></div>
        </article>

        <article class="feature-card">
          <span class="feature-index">02</span>
          <h3>Sem conta. Sem nuvem.</h3>
          <p>O Dokke conecta seus dispositivos diretamente. Menos cadastro, menos coisa para configurar.</p>
          <div class="feature-line"></div>
        </article>

        <article class="feature-card feature-card--wide">
          <div>
            <span class="feature-index">03</span>
            <h3>Do download ao primeiro toque.</h3>
            <p>Baixe o DMG, arraste para Aplicativos e escolha seus apps. O celular encontra o Mac sozinho.</p>
          </div>
          <div class="feature-points"><span>PIN de acesso</span><span>Tempo real</span><span>APK + PWA</span><span>MIT</span></div>
        </article>
      </div>
    </div>
  </section>

  <section class="roadmap-section" id="roadmap" aria-labelledby="roadmap-title">
    <div class="section-shell roadmap-shell">
      <header class="roadmap-heading">
        <p class="section-kicker">03 / próximos capítulos</p>
        <h2 id="roadmap-title">O que vem<br /><em>depois.</em></h2>
        <p class="roadmap-intro">O que já existe está marcado. O resto são os próximos atalhos para deixar o Mac ainda mais acessível.</p>
        <div class="version-badge"><span></span> disponível agora · v0.2.8</div>
      </header>

      <div class="roadmap-list">
        <article class="roadmap-item roadmap-item--available">
          <span class="roadmap-status">já existe</span>
          <div><h3>Alternar entre os aplicativos abertos</h3><p>Veja o que está rodando no Mac e troque de app direto pelo dock.</p></div>
        </article>
        <article class="roadmap-item">
          <span class="roadmap-status">spoiler</span>
          <div><h3>Controlar o OBS Studio</h3><p>Mude a cena, inicie ou pare a gravação e acompanhe a live sem sair do celular.</p></div>
        </article>
        <article class="roadmap-item">
          <span class="roadmap-status">spoiler</span>
          <div><h3>Volume e mídia</h3><p>Aumente, reduza, pause e continue o que está tocando no Mac.</p></div>
        </article>
        <article class="roadmap-item">
          <span class="roadmap-status">spoiler</span>
          <div><h3>Um teclado só de emoji</h3><p>Puxe a mesma ideia da tecla de emoji do Mac para responder, criar e compartilhar sem trocar de tela.</p></div>
        </article>
        <article class="roadmap-item">
          <span class="roadmap-status">spoiler</span>
          <div><h3>Crie todos os seus fluxos de trabalho ✨</h3><p>Conecte o Dokke ao Apple Shortcuts e transforme ações repetidas em um toque.</p></div>
        </article>
      </div>
    </div>
  </section>

  <section class="community-section" id="community" aria-labelledby="community-title">
    <div class="section-shell community-shell">
      <header class="community-heading">
        <p class="section-kicker">04 / construção em comunidade</p>
        <h2 id="community-title">O próximo atalho<br /><em>pode vir de você.</em></h2>
        <p class="community-intro">O Dokke é construído em comunidade. Encontrou um bug, teve uma ideia ou quer ajudar? Comente no GitHub — é lá que o projeto é analisado e evolui.</p>
        <a class="community-cta" href="https://github.com/felipenalves/Dokke/discussions" target="_blank" rel="noreferrer">Comentar no GitHub <span aria-hidden="true">↗</span></a>
      </header>

      <div class="community-actions" aria-label="Como contribuir com o Dokke">
        <a class="community-action" href="https://github.com/felipenalves/Dokke/issues/new?template=bug_report.yml" target="_blank" rel="noreferrer">
          <span class="community-action-type">BUG</span>
          <div><h3>Encontrou um problema?</h3><p>Abra uma Issue e conte a versão, o dispositivo e os passos para reproduzir.</p></div>
          <span class="community-action-arrow" aria-hidden="true">↗</span>
        </a>
        <a class="community-action" href="https://github.com/felipenalves/Dokke/discussions/categories/ideas" target="_blank" rel="noreferrer">
          <span class="community-action-type">IDEIA</span>
          <div><h3>Imaginou uma feature?</h3><p>Abra uma Discussion em Ideas. O que a comunidade pedir pode virar o próximo lançamento.</p></div>
          <span class="community-action-arrow" aria-hidden="true">↗</span>
        </a>
        <a class="community-action" href="https://github.com/felipenalves/Dokke/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer">
          <span class="community-action-type">AJUDA</span>
          <div><h3>Quer construir junto?</h3><p>Leia como contribuir, testar e manter cada mudança pequena e útil.</p></div>
          <span class="community-action-arrow" aria-hidden="true">↗</span>
        </a>

        <aside class="community-club">
          <p class="community-club-kicker">Outro produto · Documente Club</p>
          <h3>IA aplicada para quem está construindo.</h3>
          <p>Uma comunidade paga para builders, entusiastas de IA e solo founders que querem implementar IA de verdade em projetos e negócios.</p>
          <a class="community-club-cta" href="${communityUrl}" target="_blank" rel="noreferrer">Conhecer o Documente Club <span aria-hidden="true">↗</span></a>
        </aside>
      </div>
    </div>
  </section>

  <section class="faq-section" id="faq" aria-labelledby="faq-title">
    <div class="section-shell faq-shell">
      <header class="faq-heading">
        <p class="section-kicker">05 / perguntas frequentes</p>
        <h2 id="faq-title">Antes de instalar,<br /><em>sem surpresa.</em></h2>
      </header>

      <div class="faq-list">
        <details>
          <summary>Preciso instalar Node.js?</summary>
          <p>Não para usar o DMG. O Node já vem embutido no Dokke para Mac. Ele só é necessário para quem quer rodar ou desenvolver pelo código.</p>
        </details>
        <details>
          <summary>O Mac e o celular precisam estar na mesma rede?</summary>
          <p>Sim. O Dokke é local-first: o Mac e o dispositivo precisam conseguir conversar pela mesma rede Wi-Fi ou LAN.</p>
        </details>
        <details>
          <summary>Como acesso pelo iPhone?</summary>
          <p>Abra no Safari o endereço mostrado pelo Dokke e, se quiser, use Adicionar à Tela de Início. O iPhone funciona como PWA.</p>
        </details>
        <details>
          <summary>O Dokke envia meus dados para a nuvem?</summary>
          <p>Não. O Mac conversa diretamente com os dispositivos na sua rede local. O Dokke não precisa de conta ou servidor externo.</p>
        </details>
        <details>
          <summary>O que faço se o macOS bloquear o app?</summary>
          <p>Clique com o botão direito no <b>Dokke.app</b>, escolha <b>Abrir</b> e confirme. Se essa opção não aparecer, abra <b>Ajustes do Sistema → Privacidade e Segurança → Segurança → Abrir Mesmo Assim → Abrir</b>. Esse aviso pode aparecer porque o Dokke é distribuído fora da App Store.</p>
        </details>
        <details>
          <summary>Já existe uma versão para Windows?</summary>
          <p>Ainda não. A primeira release pública é para macOS, com Android e PWA como clientes. Windows está planejado para uma próxima etapa.</p>
        </details>
      </div>
    </div>
  </section>

  <footer class="site-footer">
    <a class="footer-brand" href="#section-01" aria-label="Voltar ao início">Dokke</a>
    <p class="footer-note">© 2026 Dokke · um produto de Felipe Natanael</p>
    <nav class="footer-links" aria-label="Links sociais">
      <a href="https://instagram.com/felipenalves" target="_blank" rel="noreferrer">Instagram</a>
      <a href="https://x.com/felipenalves" target="_blank" rel="noreferrer">X</a>
      <a href="https://github.com/felipenalves/Dokke" target="_blank" rel="noreferrer">GitHub</a>
    </nav>
  </footer>
`;

const LANDING_SELECTORS = {
  ".nav-shell": ["nav.aria", "aria"],
  ".nav-links a:nth-child(1)": ["nav.features"],
  ".nav-links a:nth-child(2)": ["nav.community"],
  ".nav-links a:nth-child(3)": ["nav.docs"],
  ".nav-actions .github-link span": ["nav.github"],
  ".eyebrow": ["hero.eyebrow"],
  "#hero-title": ["hero.title", "html"],
  ".hero-copy": ["hero.copy"],
  ".hero-actions .primary-button:nth-of-type(1) span": ["hero.mac"],
  ".hero-actions .primary-button--android span": ["hero.android"],
  ".hero-meta": ["hero.meta"],
  ".features-section .section-kicker": ["features.kicker"],
  "#features-title": ["features.title", "html"],
  ".feature-card:nth-child(1) h3": ["feature.1.title"],
  ".feature-card:nth-child(1) p": ["feature.1.copy"],
  ".feature-card:nth-child(2) h3": ["feature.2.title"],
  ".feature-card:nth-child(2) p": ["feature.2.copy"],
  ".feature-card:nth-child(3) h3": ["feature.3.title"],
  ".feature-card:nth-child(3) p": ["feature.3.copy"],
  ".roadmap-heading .section-kicker": ["roadmap.kicker"],
  "#roadmap-title": ["roadmap.title", "html"],
  ".roadmap-intro": ["roadmap.intro"],
  ".roadmap-item:nth-child(1) .roadmap-status": ["roadmap.exists"],
  ".roadmap-item:nth-child(1) h3": ["roadmap.1.title"], ".roadmap-item:nth-child(1) p": ["roadmap.1.copy"],
  ".roadmap-item:nth-child(2) h3": ["roadmap.2.title"], ".roadmap-item:nth-child(2) p": ["roadmap.2.copy"],
  ".roadmap-item:nth-child(3) h3": ["roadmap.3.title"], ".roadmap-item:nth-child(3) p": ["roadmap.3.copy"],
  ".roadmap-item:nth-child(4) h3": ["roadmap.4.title"], ".roadmap-item:nth-child(4) p": ["roadmap.4.copy"],
  ".roadmap-item:nth-child(5) h3": ["roadmap.5.title"], ".roadmap-item:nth-child(5) p": ["roadmap.5.copy"],
  ".community-heading .section-kicker": ["community.kicker"], "#community-title": ["community.title", "html"], ".community-intro": ["community.intro"], ".community-cta": ["community.cta"], ".community-actions": ["community.aria", "aria"],
  ".community-action:nth-child(1) h3": ["community.1.title"], ".community-action:nth-child(1) p": ["community.1.copy"],
  ".community-action:nth-child(2) h3": ["community.2.title"], ".community-action:nth-child(2) p": ["community.2.copy"],
  ".community-action:nth-child(3) h3": ["community.3.title"], ".community-action:nth-child(3) p": ["community.3.copy"],
  ".community-club-kicker": ["club.kicker"], ".community-club h3": ["club.title"], ".community-club p:not(.community-club-kicker)": ["club.copy"], ".community-club-cta": ["club.cta"],
  ".faq-heading .section-kicker": ["faq.kicker"], "#faq-title": ["faq.title", "html"],
  ".faq-list details:nth-child(1) summary": ["faq.1.q"], ".faq-list details:nth-child(1) p": ["faq.1.a"],
  ".faq-list details:nth-child(2) summary": ["faq.2.q"], ".faq-list details:nth-child(2) p": ["faq.2.a"],
  ".faq-list details:nth-child(3) summary": ["faq.3.q"], ".faq-list details:nth-child(3) p": ["faq.3.a"],
  ".faq-list details:nth-child(4) summary": ["faq.4.q"], ".faq-list details:nth-child(4) p": ["faq.4.a"],
  ".faq-list details:nth-child(5) summary": ["faq.5.q"], ".faq-list details:nth-child(5) p": ["faq.5.a"],
  ".faq-list details:nth-child(6) summary": ["faq.6.q"], ".faq-list details:nth-child(6) p": ["faq.6.a"],
  ".footer-brand": ["footer.back", "aria"], ".footer-note": ["footer.note"], ".footer-links": ["footer.aria", "aria"]
};

function applyLandingLanguage() {
  const copy = LANDING_COPY[landingLanguage];
  Object.entries(LANDING_SELECTORS).forEach(([selector, [key, mode]]) => {
    const element = document.querySelector(selector);
    if (!element || !copy[key]) return;
    if (mode === "html") element.innerHTML = copy[key];
    else if (mode === "aria") element.setAttribute("aria-label", copy[key]);
    else element.textContent = copy[key];
  });
  const windows = copy["hero.windows"].split("|");
  const windowsNote = document.querySelector(".windows-note");
  if (windowsNote) windowsNote.innerHTML = `<span>${windows[0]}</span> ${windows[1]}`;
  const points = copy["feature.3.points"].split("|");
  document.querySelectorAll(".feature-card:nth-child(3) .feature-points span").forEach((element, index) => {
    if (points[index]) element.textContent = points[index];
  });
  document.querySelectorAll(".language-toggle [data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === landingLanguage));
  });
  document.documentElement.lang = landingLanguage;
}

document.querySelectorAll(".language-toggle [data-language]").forEach((button) => {
  button.addEventListener("click", () => {
    landingLanguage = button.dataset.language === "en" ? "en" : "pt-BR";
    try { localStorage.setItem(LANDING_LANGUAGE_KEY, landingLanguage); } catch {}
    applyLandingLanguage();
  });
});
applyLandingLanguage();

const heroEmblem = document.querySelector(".hero-emblem");
const heroSection = document.querySelector(".hero");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (heroEmblem && heroSection && finePointer.matches) {
  let frame = 0;
  let motionX = 0;
  let motionY = 0;
  let rotation = 0;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const renderMotion = () => {
    frame = 0;

    if (reducedMotion.matches) {
      heroEmblem.style.setProperty("--hero-mx", "0px");
      heroEmblem.style.setProperty("--hero-my", "0px");
      heroEmblem.style.setProperty("--hero-rotate", "0deg");
      return;
    }

    heroEmblem.style.setProperty("--hero-mx", `${motionX.toFixed(2)}px`);
    heroEmblem.style.setProperty("--hero-my", `${motionY.toFixed(2)}px`);
    heroEmblem.style.setProperty("--hero-rotate", `${rotation.toFixed(2)}deg`);
  };

  const scheduleMotion = () => {
    if (!frame) frame = requestAnimationFrame(renderMotion);
  };

  const resetHeroMotion = () => {
    motionX = 0;
    motionY = 0;
    rotation = 0;
    heroEmblem.classList.remove("is-hero-tracking", "is-hero-pressed");
    scheduleMotion();
  };

  const setHeroPressed = (pressed) => {
    if (reducedMotion.matches) return;
    heroEmblem.classList.toggle("is-hero-pressed", pressed);
  };

  const releaseHeroPress = () => setHeroPressed(false);

  heroEmblem.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    setHeroPressed(true);
  });

  heroEmblem.addEventListener("pointerup", releaseHeroPress);
  heroEmblem.addEventListener("pointercancel", releaseHeroPress);
  heroEmblem.addEventListener("pointerleave", releaseHeroPress);

  heroEmblem.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setHeroPressed(true);
  });

  heroEmblem.addEventListener("keyup", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    releaseHeroPress();
  });

  heroSection.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || (event.pointerType && event.pointerType !== "mouse")) return;

    const bounds = heroSection.getBoundingClientRect();
    const normalizedX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const normalizedY = (event.clientY - bounds.top) / bounds.height - 0.5;

    motionX = clamp(normalizedX * 8, -4, 4);
    motionY = clamp(normalizedY * 8, -4, 4);
    rotation = clamp(normalizedX * 4, -2, 2);
    heroEmblem.classList.add("is-hero-tracking");
    scheduleMotion();
  });

  heroSection.addEventListener("pointerleave", resetHeroMotion);
  reducedMotion.addEventListener("change", resetHeroMotion);
}
