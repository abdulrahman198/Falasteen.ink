// web3-token.js — Safe Web3 token widget for FALASTEEN.INK.
// لا تحفظ private key أبدًا. لا تطلب seed phrase أبدًا. كل العمليات تتم عبر محفظة المستخدم.
(function() {
  'use strict';

  const TOKEN_CONFIG = {
    chainId: "0x38",
    chainName: "BNB Smart Chain",
    tokenAddress: "0x0C091900bA04376a3AEb0aFC48FAa995c0f1bFCf",
    tokenSymbol: "HANZALA",
    tokenDecimals: 18,
    rpcUrl: "https://bsc-dataseed.binance.org/",
    donationAddress: "0xef959E3d6221409a1f4dfA549BDC9481eD30Ecf8"
  };

  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];

  const state = {
    provider: null,
    signer: null,
    address: "",
    chainId: "",
    network: "",
    balance: null,
    status: "",
    error: ""
  };

  function log() {
    if (window.console) console.log.apply(console, ["[FLToken]"].concat([].slice.call(arguments)));
  }

  function warn() {
    if (window.console) console.warn.apply(console, ["[FLToken]"].concat([].slice.call(arguments)));
  }

  function isPlaceholder(value) {
    return !value || /^PUT_/i.test(String(value));
  }

  // Read decimals + symbol from the on-chain contract once, so balances and
  // transfers stay correct even if the token does not use 18 decimals.
  let _metaLoaded = false;
  async function loadTokenMeta() {
    if (_metaLoaded || !hasEthers() || !state.provider || isPlaceholder(TOKEN_CONFIG.tokenAddress)) return;
    try {
      const c = new window.ethers.Contract(TOKEN_CONFIG.tokenAddress, ERC20_ABI, state.provider);
      const [dec, sym] = await Promise.all([c.decimals(), c.symbol()]);
      if (dec !== undefined && dec !== null) TOKEN_CONFIG.tokenDecimals = Number(dec);
      if (sym) TOKEN_CONFIG.tokenSymbol = sym;
      _metaLoaded = true;
    } catch (e) {
      warn("loadTokenMeta failed (using configured defaults)", e);
    }
  }

  function shortAddress(address) {
    if (!address) return "—";
    return address.slice(0, 6) + "..." + address.slice(-4);
  }

  function hasWallet() {
    return !!window.ethereum;
  }

  function hasEthers() {
    return !!window.ethers;
  }

  function getBox() {
    return document.getElementById("flWalletBox");
  }

  function setStatus(message, isError) {
    state.status = isError ? "" : message;
    state.error = isError ? message : "";
    render();
  }

  async function refreshProvider() {
    if (!hasWallet()) return null;
    state.chainId = await window.ethereum.request({ method: "eth_chainId" }).catch(function() { return ""; });
    if (!hasEthers()) {
      state.provider = null;
      state.signer = null;
      state.network = TOKEN_CONFIG.chainName;
      return null;
    }
    state.provider = new window.ethers.BrowserProvider(window.ethereum);
    state.signer = state.address ? await state.provider.getSigner() : null;
    try {
      const network = await state.provider.getNetwork();
      state.network = network && network.name && network.name !== "unknown" ? network.name : TOKEN_CONFIG.chainName;
    } catch (e) {
      state.network = TOKEN_CONFIG.chainName;
    }
    return state.provider;
  }

  async function connectWallet() {
    log("Connect wallet clicked.", {
      hasEthereum: hasWallet(),
      hasEthers: hasEthers(),
      protocol: window.location.protocol,
      host: window.location.host
    });
    if (!hasWallet()) {
      setStatus("يرجى تثبيت MetaMask أو فتح الموقع من Chrome/Brave يدعم المحافظ. متصفح Codex الداخلي لا يحتوي MetaMask.", true);
      return null;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      state.address = accounts && accounts[0] ? accounts[0] : "";
      localStorage.setItem("fl_token_wallet", state.address);
      await refreshProvider();
      if (hasEthers()) {
        await getTokenBalance();
      } else {
        state.balance = null;
        state.status = "تم الاتصال بالمحفظة. تعذر تحميل ethers.js لذلك لن يظهر رصيد العملة الآن.";
      }
      log("Wallet connected:", state.address, state.chainId);
      render();
      return state.address;
    } catch (err) {
      warn("connectWallet failed", err);
      setStatus(err && err.message ? err.message : "فشل الاتصال بالمحفظة.", true);
      return null;
    }
  }

  function disconnectWallet() {
    state.provider = null;
    state.signer = null;
    state.address = "";
    state.chainId = "";
    state.network = "";
    state.balance = null;
    state.status = "تم فصل المحفظة محليًا.";
    state.error = "";
    localStorage.removeItem("fl_token_wallet");
    render();
  }

  async function getTokenBalance() {
    if (!state.address) return null;
    if (!hasEthers()) {
      setStatus("تعذر تحميل ethers.js.", true);
      return null;
    }
    await refreshProvider();
    if (isPlaceholder(TOKEN_CONFIG.tokenAddress)) {
      state.balance = null;
      state.status = "ضع عنوان عقد العملة لعرض الرصيد.";
      render();
      return null;
    }
    try {
      await loadTokenMeta();
      const contract = new window.ethers.Contract(TOKEN_CONFIG.tokenAddress, ERC20_ABI, state.provider);
      const raw = await contract.balanceOf(state.address);
      state.balance = window.ethers.formatUnits(raw, TOKEN_CONFIG.tokenDecimals);
      state.status = "";
      state.error = "";
      render();
      return state.balance;
    } catch (err) {
      warn("getTokenBalance failed", err);
      setStatus("تعذر قراءة رصيد العملة. تحقق من العقد والشبكة.", true);
      return null;
    }
  }

  async function addTokenToWallet() {
    if (!hasWallet()) {
      setStatus("يرجى تثبيت MetaMask أو فتح الموقع من متصفح يدعم المحافظ.", true);
      return false;
    }
    if (isPlaceholder(TOKEN_CONFIG.tokenAddress)) {
      setStatus("أضف tokenAddress الحقيقي قبل إضافة العملة للمحفظة.", true);
      return false;
    }
    try {
      const added = await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: TOKEN_CONFIG.tokenAddress,
            symbol: TOKEN_CONFIG.tokenSymbol,
            decimals: TOKEN_CONFIG.tokenDecimals
          }
        }
      });
      setStatus(added ? "تم إرسال طلب إضافة العملة للمحفظة." : "لم تتم إضافة العملة.");
      return !!added;
    } catch (err) {
      warn("addTokenToWallet failed", err);
      setStatus(err && err.message ? err.message : "فشل طلب إضافة العملة.", true);
      return false;
    }
  }

  async function switchNetwork() {
    if (!hasWallet()) {
      setStatus("يرجى تثبيت MetaMask أو فتح الموقع من متصفح يدعم المحافظ.", true);
      return false;
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TOKEN_CONFIG.chainId }]
      });
      await refreshProvider();
      await getTokenBalance();
      render();
      return true;
    } catch (err) {
      if (err && err.code === 4902) {
        if (isPlaceholder(TOKEN_CONFIG.rpcUrl)) {
          setStatus("أضف rpcUrl صحيحًا قبل إضافة شبكة جديدة للمحفظة.", true);
          return false;
        }
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: TOKEN_CONFIG.chainId,
              chainName: TOKEN_CONFIG.chainName,
              rpcUrls: [TOKEN_CONFIG.rpcUrl],
              nativeCurrency: {
                name: TOKEN_CONFIG.chainName,
                symbol: TOKEN_CONFIG.chainId === "0x89" ? "MATIC" : TOKEN_CONFIG.chainId === "0x38" ? "BNB" : "ETH",
                decimals: 18
              }
            }]
          });
          await refreshProvider();
          render();
          return true;
        } catch (addErr) {
          warn("wallet_addEthereumChain failed", addErr);
          setStatus(addErr && addErr.message ? addErr.message : "تعذر إضافة الشبكة.", true);
          return false;
        }
      }
      warn("switchNetwork failed", err);
      setStatus(err && err.message ? err.message : "تعذر تبديل الشبكة.", true);
      return false;
    }
  }

  async function sendTokenDonation(toAddress, amount) {
    if (!state.address) {
      await connectWallet();
      if (!state.address) return null;
    }
    if (!hasEthers()) {
      setStatus("تعذر تحميل ethers.js.", true);
      return null;
    }
    if (isPlaceholder(TOKEN_CONFIG.tokenAddress)) {
      setStatus("أضف tokenAddress الحقيقي قبل التبرع بالعملة.", true);
      return null;
    }
    const recipient = toAddress || (isPlaceholder(TOKEN_CONFIG.donationAddress) ? "" : TOKEN_CONFIG.donationAddress);
    if (!recipient || !window.ethers.isAddress(recipient)) {
      setStatus("أضف donationAddress صحيحًا أو مرر عنوان استقبال صالح.", true);
      return null;
    }
    const value = String(amount || "").trim();
    if (!value || Number(value) <= 0) {
      setStatus("أدخل مبلغًا صالحًا للتبرع.", true);
      return null;
    }
    try {
      await refreshProvider();
      if (state.chainId !== TOKEN_CONFIG.chainId) {
        const switched = await switchNetwork();
        if (!switched) return null;
      }
      await loadTokenMeta();
      state.signer = await state.provider.getSigner();
      const contract = new window.ethers.Contract(TOKEN_CONFIG.tokenAddress, ERC20_ABI, state.signer);
      const tx = await contract.transfer(recipient, window.ethers.parseUnits(value, TOKEN_CONFIG.tokenDecimals));
      setStatus("تم إرسال المعاملة: " + tx.hash);
      await tx.wait();
      await getTokenBalance();
      setStatus("تم تأكيد التبرع. شكرًا لدعمك.");
      return tx;
    } catch (err) {
      warn("sendTokenDonation failed", err);
      setStatus(err && err.message ? err.message : "فشل إرسال التبرع.", true);
      return null;
    }
  }

  function donationPrompt() {
    const amount = window.prompt("Amount of " + TOKEN_CONFIG.tokenSymbol + " to donate:");
    if (!amount) return;
    let recipient = TOKEN_CONFIG.donationAddress;
    if (isPlaceholder(recipient)) {
      recipient = window.prompt("Donation wallet address:");
    }
    sendTokenDonation(recipient, amount);
  }

  function networkMismatch() {
    return state.address && state.chainId && state.chainId !== TOKEN_CONFIG.chainId;
  }

  function render() {
    const box = getBox();
    if (!box) return;
    const connected = !!state.address;
    const wrongNetwork = networkMismatch();
    const balanceText = state.balance === null || state.balance === undefined
      ? "—"
      : Number(state.balance).toLocaleString(undefined, { maximumFractionDigits: 6 });

    box.innerHTML =
      '<div class="fl-wallet-card" dir="rtl">' +
        '<div class="fl-wallet-head">' +
          '<div>' +
            '<div class="fl-wallet-kicker">HANDALA (حنظلة)</div>' +
            '<div class="fl-wallet-title">محفظة FALASTEEN</div>' +
          '</div>' +
          '<div class="fl-wallet-state ' + (connected ? 'is-on' : '') + '">' + (connected ? 'CONNECTED' : 'OFFLINE') + '</div>' +
        '</div>' +
        '<p class="fl-wallet-warning">هذا ليس نصيحة مالية، والعملة للاستخدام داخل المنصة فقط. لا تشارك مفاتيحك الخاصة أو seed phrase مع أي شخص.</p>' +
        (!hasWallet() ? '<div class="fl-wallet-alert">يرجى تثبيت MetaMask أو فتح الموقع من Chrome/Brave يدعم المحافظ. ملاحظة: متصفح Codex الداخلي غالبًا لا يحتوي MetaMask. <a href="https://metamask.io/download/" target="_blank" rel="noreferrer noopener" style="color:#fff;text-decoration:underline;">تحميل MetaMask</a></div>' : '') +
        (hasWallet() && !hasEthers() ? '<div class="fl-wallet-alert">ethers.js غير محمل. زر الاتصال سيحفظ العنوان، لكن قراءة رصيد العملة تحتاج CDN أو نسخة محلية من ethers.</div>' : '') +
        (state.error ? '<div class="fl-wallet-alert">' + escapeHtml(state.error) + '</div>' : '') +
        (state.status ? '<div class="fl-wallet-note">' + escapeHtml(state.status) + '</div>' : '') +
        '<div class="fl-wallet-grid">' +
          '<div><span>Wallet</span><strong dir="ltr">' + (connected ? shortAddress(state.address) : '—') + '</strong></div>' +
          '<div><span>Network</span><strong>' + escapeHtml(state.network || TOKEN_CONFIG.chainName) + '</strong></div>' +
          '<div><span>Balance</span><strong dir="ltr">' + balanceText + ' ' + escapeHtml(TOKEN_CONFIG.tokenSymbol) + '</strong></div>' +
        '</div>' +
        '<div class="fl-wallet-actions">' +
          (!connected ? '<button type="button" data-fl-token="connect">Connect Wallet</button>' : '') +
          (connected && wrongNetwork ? '<button type="button" data-fl-token="switch">Switch Network</button>' : '') +
          (connected ? '<button type="button" data-fl-token="refresh">Refresh Balance</button>' : '') +
          (connected ? '<button type="button" data-fl-token="add">Add Token to Wallet</button>' : '') +
          (connected ? '<button type="button" data-fl-token="donate">Donate with Token</button>' : '') +
          (connected ? '<button type="button" data-fl-token="disconnect" class="ghost">Disconnect</button>' : '') +
        '</div>' +
      '</div>';

    box.querySelectorAll("[data-fl-token]").forEach(function(button) {
      button.addEventListener("click", function() {
        const action = button.getAttribute("data-fl-token");
        if (action === "connect") connectWallet();
        if (action === "disconnect") disconnectWallet();
        if (action === "refresh") getTokenBalance();
        if (action === "add") addTokenToWallet();
        if (action === "switch") switchNetwork();
        if (action === "donate") donationPrompt();
      });
    });
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function(ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  async function restoreIfAuthorized() {
    render();
    if (!hasWallet() || !hasEthers()) return;
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts && accounts[0]) {
        state.address = accounts[0];
        localStorage.setItem("fl_token_wallet", state.address);
        await refreshProvider();
        await getTokenBalance();
      }
    } catch (e) {
      warn("restoreIfAuthorized failed", e);
    }
  }

  function bindWalletEvents() {
    if (!window.ethereum || window.ethereum.__flTokenBound) return;
    window.ethereum.__flTokenBound = true;
    window.ethereum.on && window.ethereum.on("accountsChanged", function(accounts) {
      if (accounts && accounts[0]) {
        state.address = accounts[0];
        localStorage.setItem("fl_token_wallet", state.address);
        refreshProvider().then(getTokenBalance).then(render);
      } else {
        disconnectWallet();
      }
    });
    window.ethereum.on && window.ethereum.on("chainChanged", function(chainId) {
      state.chainId = chainId;
      refreshProvider().then(getTokenBalance).then(render);
    });
  }

  window.FLToken = {
    config: TOKEN_CONFIG,
    state: state,
    connectWallet: connectWallet,
    disconnectWallet: disconnectWallet,
    getTokenBalance: getTokenBalance,
    addTokenToWallet: addTokenToWallet,
    switchNetwork: switchNetwork,
    sendTokenDonation: sendTokenDonation,
    render: render
    // TODO: Add WalletConnect provider support.
  };

  // Backward-compatible globals for older inline buttons in setup pages.
  window.connectWallet = connectWallet;
  window.disconnectWallet = disconnectWallet;
  window.getTokenBalance = getTokenBalance;
  window.addTokenToWallet = addTokenToWallet;
  window.switchNetwork = switchNetwork;
  window.sendTokenDonation = sendTokenDonation;

  document.addEventListener("DOMContentLoaded", function() {
    bindWalletEvents();
    restoreIfAuthorized();
  });

  log("Web3 token module ready. Configure tokenAddress, rpcUrl, and donationAddress in web3-token.js.");
})();
