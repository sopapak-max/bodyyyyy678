/* ==========================================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   ตรวจจากหน้าว่ามี element ไหนอยู่ แล้วทำงานเฉพาะส่วนนั้น

   ID ที่ใช้ในไฟล์นี้:
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable (อ่านจาก #ordersTable tbody)
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     ค่าตั้งต้น
     ------------------------------------------------------------------------ */
  var PRODUCTS_URL = "products.json";

  // ถ้าลิงก์ Apps Script ของคุณลงท้ายไม่ใช่ /exec ให้แก้ตรงนี้ที่เดียว
  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbwEwWbBt7cyQLC84TnrpOPx1F2dpbmgKUbBmCRxP63ClnZX0jx3wV0lKvrwXE2yDYofKg/exec";

  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPwzj2GDniMphf6kqk_wNpNaeQLlWZjC2X-02oT5fV4HIqbfxiyUBiGl7UQSdiEKDfrlMYpJ_EeU8C/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  var MOOD_LABELS = {
    fresh: "Fresh",
    sweet: "Sweet",
    confident: "Confident",
    romance: "Romance"
  };

  /* ------------------------------------------------------------------------
     ตัวช่วยเล็กๆ
     ------------------------------------------------------------------------ */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatPrice(value) {
    var n = Number(value);
    if (isNaN(n)) return String(value);
    return n.toLocaleString("th-TH") + " บาท";
  }

  function isValidMood(key) {
    return MOODS.some(function (m) {
      return m.key === key;
    });
  }

  /* ========================================================================
     1) หน้า product.html — โหลดสินค้า + ตัวกรอง mood
     ======================================================================== */
  function initProductPage() {
    var filterBar = document.getElementById("filter-bar");
    var list = document.getElementById("product-list");
    if (!filterBar || !list) return;

    var products = [];
    var currentMood = "all";

    // อ่าน ?mood=xxx
    var params = new URLSearchParams(window.location.search);
    var moodParam = (params.get("mood") || "").toLowerCase();
    if (isValidMood(moodParam)) currentMood = moodParam;

    renderFilterBar();

    list.textContent = "";
    list.appendChild(el("p", "text-mute", "กำลังโหลดสินค้า..."));

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];
        renderProducts();
      })
      .catch(function (error) {
        console.error(error);
        list.textContent = "";
        list.appendChild(
          el("p", "text-mute", "โหลดข้อมูลสินค้าไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง")
        );
      });

    function renderFilterBar() {
      filterBar.textContent = "";
      filterBar.classList.add("filters");

      MOODS.forEach(function (m) {
        var btn = el("button", "filter-btn");
        btn.type = "button";
        btn.setAttribute("data-filter", m.key);
        btn.setAttribute("aria-pressed", String(m.key === currentMood));

        if (m.key !== "all") {
          btn.setAttribute("data-mood", m.key);
          btn.appendChild(el("span", "mood-dot"));
        }
        btn.appendChild(document.createTextNode(m.label));
        filterBar.appendChild(btn);
      });

      filterBar.addEventListener("click", function (e) {
        var btn = e.target.closest(".filter-btn");
        if (!btn) return;

        currentMood = btn.getAttribute("data-filter");

        Array.prototype.forEach.call(
          filterBar.querySelectorAll(".filter-btn"),
          function (b) {
            b.setAttribute(
              "aria-pressed",
              String(b.getAttribute("data-filter") === currentMood)
            );
          }
        );

        // อัปเดต URL ให้แชร์ลิงก์ที่กรองแล้วได้ (ไม่รีโหลดหน้า)
        var url = new URL(window.location.href);
        if (currentMood === "all") {
          url.searchParams.delete("mood");
        } else {
          url.searchParams.set("mood", currentMood);
        }
        window.history.replaceState(null, "", url);

        renderProducts();
      });
    }

    function renderProducts() {
      var shown = products.filter(function (p) {
        return currentMood === "all" || p.mood === currentMood;
      });

      list.textContent = "";
      list.classList.add("product-grid");

      if (shown.length === 0) {
        list.appendChild(el("p", "text-mute", "ไม่พบสินค้าในหมวดนี้"));
        return;
      }

      shown.forEach(function (p) {
        list.appendChild(buildCard(p));
      });
    }

    function buildCard(p) {
      var itemName = p.size ? p.name + " " + p.size : p.name;

      var card = el("article", "product-card");
      card.setAttribute("data-mood", p.mood);

      // รูป
      var media = el("div", "product-card__media");
      var img = document.createElement("img");
      img.src = p.image;
      img.alt = itemName;
      img.loading = "lazy";
      img.addEventListener("error", function () {
        img.style.display = "none"; // ถ้ารูปไม่มี ให้เห็นพื้นครีมแทน
      });
      media.appendChild(img);

      // เนื้อหา
      var body = el("div", "product-card__body");

      var meta = el("div", "product-card__meta");
      meta.appendChild(el("span", "mood-text", MOOD_LABELS[p.mood] || p.mood));
      meta.appendChild(el("span", "tag", p.size ? p.size : "โรลออน"));

      var title = el("h3", "product-card__title", p.name);

      var footer = el("div", "product-card__footer");
      footer.appendChild(el("span", "price", formatPrice(p.price)));

      var orderParams = new URLSearchParams();
      orderParams.set("item", itemName);
      orderParams.set("price", p.price);

      var buy = el("a", "btn btn--small", "สั่งซื้อ");
      buy.href = "order.html?" + orderParams.toString();
      footer.appendChild(buy);

      body.appendChild(meta);
      body.appendChild(title);
      body.appendChild(footer);

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }
  }

  /* ========================================================================
     2) หน้า order.html — เติมฟอร์มจาก URL + ส่งออเดอร์
     ======================================================================== */
  function initOrderPage() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    var customerName = document.getElementById("customerName");
    var contact = document.getElementById("contact");
    var items = document.getElementById("items");
    var total = document.getElementById("total");
    var note = document.getElementById("note");

    // เติมค่าจาก ?item=...&price=... ทันทีที่โหลดหน้า
    var params = new URLSearchParams(window.location.search);
    var itemParam = params.get("item");
    var priceParam = params.get("price");

    if (items && itemParam) items.value = itemParam;
    if (total && priceParam) total.value = priceParam;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (typeof form.reportValidity === "function" && !form.reportValidity()) {
        return;
      }

      var payload = {
        customerName: customerName ? customerName.value.trim() : "",
        contact: contact ? contact.value.trim() : "",
        items: items ? items.value.trim() : "",
        total: total ? total.value.trim() : "",
        note: note ? note.value.trim() : ""
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true; // กันกดซ้ำ

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(function () {
          window.location.href = "thankyou.html";
        })
        .catch(function (error) {
          console.error(error);
          if (submitBtn) submitBtn.disabled = false;
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        });
    });
  }

  /* ========================================================================
     3) หน้า admin.html — ดึง CSV จาก Google Sheets แสดงเป็นตาราง
     ======================================================================== */

  // parse CSV เอง: รองรับเครื่องหมายคำพูด, "" ในฟิลด์, ขึ้นบรรทัดใหม่ในฟิลด์, CRLF
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i = 0;

    // ตัด BOM ถ้ามี
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    while (i < text.length) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += ch;
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(field);
        field = "";
        i++;
      } else if (ch === "\r") {
        i++; // ข้าม แล้วให้ \n จัดการจบแถว
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i++;
      } else {
        field += ch;
        i++;
      }
    }

    // แถวสุดท้ายที่ไม่มี \n ปิดท้าย
    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    // ตัดแถวว่างทั้งแถว
    return rows.filter(function (r) {
      return r.some(function (cell) {
        return cell.trim() !== "";
      });
    });
  }

  function initAdminPage() {
    var tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    var COLUMNS = 6; // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ

    function showMessage(message) {
      tbody.textContent = "";
      var tr = document.createElement("tr");
      var td = el("td", "text-mute", message);
      td.colSpan = COLUMNS;
      td.style.textAlign = "center";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage("กำลังโหลดข้อมูล...");

    fetch(ORDERS_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);

        // แถวแรกคือหัวคอลัมน์ ตัดทิ้ง
        var dataRows = rows.slice(1);

        if (dataRows.length === 0) {
          showMessage("ยังไม่มีรายการสั่งซื้อ");
          return;
        }

        // ชีตเรียงเก่า → ใหม่ (ออเดอร์ใหม่ต่อท้าย) จึงกลับลำดับให้ล่าสุดขึ้นก่อน
        dataRows.reverse();

        tbody.textContent = "";
        dataRows.forEach(function (r) {
          var tr = document.createElement("tr");
          for (var c = 0; c < COLUMNS; c++) {
            tr.appendChild(el("td", "", r[c] !== undefined ? r[c] : ""));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showMessage("โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง");
      });
  }

  /* ------------------------------------------------------------------------
     เริ่มทำงานเมื่อ DOM พร้อม
     ------------------------------------------------------------------------ */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
