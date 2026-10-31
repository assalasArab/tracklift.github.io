/* ═══════════════════════════════════════════════════════════
   Boutique : dépenser ses flammes pour débloquer des pièces d'avatar.
   La réserve vient des pesées (js/flames.js) ; les prix sont dans
   js/avatar-parts.js (SHOP_PRICES). D'autres objets viendront ensuite.
   ═══════════════════════════════════════════════════════════ */
import { showToast } from "./utils.js?v=20261031a";
import { i18n } from "./i18n.js?v=20261031a";
import { DB } from "./db.js?v=20261031a";
import { flameWallet, BONUS_TIERS, FLAME_BASE } from "./flames.js?v=20261031a";
import { SHOP_PRICES, priceOf, AVATAR_CATEGORIES } from "./avatar-parts.js?v=20261031a";
import { avatarSvg, AvatarLocks, normalizeAvatar } from "./avatar.js?v=20261031a";
import { Social } from "./social.js?v=20261031a";
import { t, esc, cap, openSheet, sheetHead } from "./potes-ui.js?v=20261031a";

const tagOf = (key, id) => `${key}:${id}`;
const listeners = new Set();
const FLAME = `<svg class="sh-flame" viewBox="0 0 24 24" aria-hidden="true"><use href="#flame-icon"/></svg>`;
export const formatMult = mult => mult.toLocaleString(i18n.getLocale(), { maximumFractionDigits: 1 });

export const Shop = {
  /** Réserve, bonus en cours, prochain gain */
  wallet() { return flameWallet(DB.getWeightLog(), DB.getPurchases()); },

  owned(key, id) { return !priceOf(key, id) || DB.getPurchases().some(item => item.id === tagOf(key, id)); },

  /** Débloque une pièce si la réserve suffit ; renvoie vrai si elle est à toi */
  buy(key, id) {
    const price = priceOf(key, id);
    if (!price || this.owned(key, id)) return true;
    if (this.wallet().balance < price) return false;
    DB.addPurchase({ id: tagOf(key, id), price, at: Date.now() });
    listeners.forEach(fn => fn());
    return true;
  },

  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /** À l'ouverture de la boutique : les pièces déjà portées restent à toi (offertes, une seule fois) */
  grantWorn(avatar) {
    if (!avatar || DB.loadFailed || DB.getProfile()?.shopGranted) return;
    const config = normalizeAvatar(avatar);
    for (const [key, id] of Object.entries(config)) {
      if (priceOf(key, id) && !this.owned(key, id)) DB.addPurchase({ id: tagOf(key, id), price: 0, at: Date.now(), gift: true });
    }
    DB.updateProfile({ shopGranted: true });
  }
};

// l'éditeur d'avatar demande ici ce qui est verrouillé
Object.assign(AvatarLocks, {
  priceOf,
  owned: (key, id) => Shop.owned(key, id),
  balance: () => Shop.wallet().balance,
  buy: (key, id) => Shop.buy(key, id)
});

/** Paliers du bonus, le palier en cours mis en avant */
function tiersHtml(run) {
  const current = BONUS_TIERS.filter(tier => Math.max(run, 1) >= tier.from).pop();
  return BONUS_TIERS.map(tier => `
    <li class="sh-tier${tier === current ? " is-now" : ""}">
      <b>×${esc(formatMult(tier.mult))}</b><small>${esc(t("shopTierFrom", { days: tier.from }))}</small>
    </li>`).join("");
}

function statusText(wallet) {
  if (wallet.doneToday) return t("shopStatusDone", { gain: wallet.todayGain, mult: formatMult(wallet.mult), next: wallet.nextGain });
  if (wallet.run) return t("shopStatusKeep", { gain: wallet.nextGain, mult: formatMult(wallet.nextMult) });
  return t("shopStatusStart", { gain: wallet.nextGain });
}

export function openShop() {
  let off = null;
  let confirming = null;
  const { sheet } = openSheet({ onClose: () => off?.() });
  if (Social.avatar) Shop.grantWorn(Social.avatar);

  const itemHtml = (cat, item, avatar, wallet) => {
    const key = cat.key;
    const tag = tagOf(key, item.id);
    const price = priceOf(key, item.id);
    const owned = Shop.owned(key, item.id);
    const worn = avatar[key] === item.id;
    const name = cap(t(`avatarParts.${key}.${item.id}`));
    let action;
    if (owned && worn) action = `<span class="sh-tag">${esc(t("shopWorn"))}</span>`;
    else if (owned) action = `<button type="button" class="btn btn-ghost btn-sm" data-sh-wear="${esc(tag)}" aria-label="${esc(t("shopWearOf", { name }))}">${esc(t("shopWear"))}</button>`;
    else if (wallet.balance < price) action = `<span class="sh-missing">${esc(t("shopMissingShort", { count: price - wallet.balance }))}</span>`;
    else action = `<button type="button" class="btn btn-primary btn-sm" data-sh-buy="${esc(tag)}" aria-label="${esc(t("shopUnlockOf", { name, price }))}">${esc(t(confirming === tag ? "shopConfirm" : "shopUnlock", { price }))}</button>`;
    return `
      <li class="sh-item${owned ? " is-owned" : ""}">
        <span class="sh-preview">${avatarSvg({ ...avatar, [key]: item.id }, { size: 76 })}</span>
        <b class="sh-name">${esc(name)}</b>
        <span class="sh-price">${owned ? esc(t("shopOwned")) : `${FLAME}${price}`}</span>
        ${action}
      </li>`;
  };

  const draw = () => {
    const wallet = Shop.wallet();
    const avatar = normalizeAvatar(Social.avatar || {});
    const focusTag = sheet.contains(document.activeElement) ? document.activeElement.dataset?.shBuy || document.activeElement.dataset?.shWear : null;
    const sections = AVATAR_CATEGORIES.filter(cat => SHOP_PRICES[cat.key]).map(cat => {
      const items = cat.items.filter(item => priceOf(cat.key, item.id));
      return `
        <section class="sh-cat" aria-labelledby="sh-${cat.key}">
          <h3 class="sh-cat-title" id="sh-${cat.key}">${esc(t(`avatarField.${cat.key}`))}</h3>
          <ul class="sh-grid">${items.map(item => itemHtml(cat, item, avatar, wallet)).join("")}</ul>
        </section>`;
    }).join("");
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(t("shopTitle"))}
        <div class="sh-wallet">${FLAME}<p><b>${wallet.balance}</b><span>${esc(t("shopBalanceLabel"))}</span></p></div>
        <p class="tl-sheet-hand">${esc(t("shopHand"))}</p>
        <section class="card pt-card sh-how" aria-labelledby="sh-how-title">
          <h3 class="sh-how-title" id="sh-how-title">${esc(t("shopHowTitle"))}</h3>
          <p class="pt-text">${esc(t("shopHowText", { base: FLAME_BASE }))}</p>
          <ol class="sh-tiers" aria-label="${esc(t("shopTiersLabel"))}">${tiersHtml(wallet.run)}</ol>
          <p class="sh-status" aria-live="polite">${esc(statusText(wallet))}</p>
          <p class="gr-fine">${esc(t("shopKeep"))}</p>
        </section>
        ${sections}
        <p class="sh-soon">${esc(t("shopSoon"))}</p>
      </div>`;
    if (focusTag) sheet.querySelector(`[data-sh-buy="${CSS.escape(focusTag)}"], [data-sh-wear="${CSS.escape(focusTag)}"]`)?.focus();
  };
  draw();
  sheet.querySelector("#tl-sheet-title").focus();
  off = Shop.onChange(draw);

  sheet.addEventListener("click", async event => {
    const buy = event.target.closest("[data-sh-buy]");
    const wear = event.target.closest("[data-sh-wear]");
    if (buy) {
      const tag = buy.dataset.shBuy;
      // deux temps : un premier toucher demande confirmation, le second dépense
      if (confirming !== tag) { confirming = tag; draw(); sheet.querySelector(`[data-sh-buy="${CSS.escape(tag)}"]`)?.focus(); return; }
      confirming = null;
      const [key, id] = tag.split(":");
      if (Shop.buy(key, id)) showToast(t("shopUnlocked", { name: cap(t(`avatarParts.${key}.${id}`)) }));
      draw();
      return;
    }
    if (wear) {
      const [key, id] = wear.dataset.shWear.split(":");
      wear.disabled = true;
      try {
        await Social.saveAvatar({ ...normalizeAvatar(Social.avatar || {}), [key]: id });
        showToast(t("shopWearDone", { name: cap(t(`avatarParts.${key}.${id}`)) }));
      } catch (err) {
        console.error("[TrackLift] boutique :", err);
        showToast(t("avatarSaveError"));
      }
      draw();
    }
  });
}
