// Phone number box with a country picker (flag + dialling code).
// The saved answer looks like "+234 8012345678".
const RAW = "AF|Afghanistan|93,AL|Albania|355,DZ|Algeria|213,AD|Andorra|376,AO|Angola|244,AG|Antigua and Barbuda|1268,AR|Argentina|54,AM|Armenia|374,AU|Australia|61,AT|Austria|43,AZ|Azerbaijan|994,BS|Bahamas|1242,BH|Bahrain|973,BD|Bangladesh|880,BB|Barbados|1246,BY|Belarus|375,BE|Belgium|32,BZ|Belize|501,BJ|Benin|229,BT|Bhutan|975,BO|Bolivia|591,BA|Bosnia and Herzegovina|387,BW|Botswana|267,BR|Brazil|55,BN|Brunei|673,BG|Bulgaria|359,BF|Burkina Faso|226,BI|Burundi|257,CV|Cabo Verde|238,KH|Cambodia|855,CM|Cameroon|237,CA|Canada|1,CF|Central African Republic|236,TD|Chad|235,CL|Chile|56,CN|China|86,CO|Colombia|57,KM|Comoros|269,CG|Congo|242,CD|Congo (DR)|243,CR|Costa Rica|506,CI|Côte d'Ivoire|225,HR|Croatia|385,CU|Cuba|53,CY|Cyprus|357,CZ|Czechia|420,DK|Denmark|45,DJ|Djibouti|253,DM|Dominica|1767,DO|Dominican Republic|1809,EC|Ecuador|593,EG|Egypt|20,SV|El Salvador|503,GQ|Equatorial Guinea|240,ER|Eritrea|291,EE|Estonia|372,SZ|Eswatini|268,ET|Ethiopia|251,FJ|Fiji|679,FI|Finland|358,FR|France|33,GA|Gabon|241,GM|Gambia|220,GE|Georgia|995,DE|Germany|49,GH|Ghana|233,GR|Greece|30,GD|Grenada|1473,GT|Guatemala|502,GN|Guinea|224,GW|Guinea-Bissau|245,GY|Guyana|592,HT|Haiti|509,HN|Honduras|504,HK|Hong Kong|852,HU|Hungary|36,IS|Iceland|354,IN|India|91,ID|Indonesia|62,IR|Iran|98,IQ|Iraq|964,IE|Ireland|353,IL|Israel|972,IT|Italy|39,JM|Jamaica|1876,JP|Japan|81,JO|Jordan|962,KZ|Kazakhstan|7,KE|Kenya|254,KI|Kiribati|686,KW|Kuwait|965,KG|Kyrgyzstan|996,LA|Laos|856,LV|Latvia|371,LB|Lebanon|961,LS|Lesotho|266,LR|Liberia|231,LY|Libya|218,LI|Liechtenstein|423,LT|Lithuania|370,LU|Luxembourg|352,MO|Macao|853,MG|Madagascar|261,MW|Malawi|265,MY|Malaysia|60,MV|Maldives|960,ML|Mali|223,MT|Malta|356,MH|Marshall Islands|692,MR|Mauritania|222,MU|Mauritius|230,MX|Mexico|52,FM|Micronesia|691,MD|Moldova|373,MC|Monaco|377,MN|Mongolia|976,ME|Montenegro|382,MA|Morocco|212,MZ|Mozambique|258,MM|Myanmar|95,NA|Namibia|264,NR|Nauru|674,NP|Nepal|977,NL|Netherlands|31,NZ|New Zealand|64,NI|Nicaragua|505,NE|Niger|227,NG|Nigeria|234,KP|North Korea|850,MK|North Macedonia|389,NO|Norway|47,OM|Oman|968,PK|Pakistan|92,PW|Palau|680,PS|Palestine|970,PA|Panama|507,PG|Papua New Guinea|675,PY|Paraguay|595,PE|Peru|51,PH|Philippines|63,PL|Poland|48,PT|Portugal|351,PR|Puerto Rico|1787,QA|Qatar|974,RO|Romania|40,RU|Russia|7,RW|Rwanda|250,KN|Saint Kitts and Nevis|1869,LC|Saint Lucia|1758,VC|Saint Vincent and the Grenadines|1784,WS|Samoa|685,SM|San Marino|378,ST|São Tomé and Príncipe|239,SA|Saudi Arabia|966,SN|Senegal|221,RS|Serbia|381,SC|Seychelles|248,SL|Sierra Leone|232,SG|Singapore|65,SK|Slovakia|421,SI|Slovenia|386,SB|Solomon Islands|677,SO|Somalia|252,ZA|South Africa|27,KR|South Korea|82,SS|South Sudan|211,ES|Spain|34,LK|Sri Lanka|94,SD|Sudan|249,SR|Suriname|597,SE|Sweden|46,CH|Switzerland|41,SY|Syria|963,TW|Taiwan|886,TJ|Tajikistan|992,TZ|Tanzania|255,TH|Thailand|66,TL|Timor-Leste|670,TG|Togo|228,TO|Tonga|676,TT|Trinidad and Tobago|1868,TN|Tunisia|216,TR|Türkiye|90,TM|Turkmenistan|993,TV|Tuvalu|688,UG|Uganda|256,UA|Ukraine|380,AE|United Arab Emirates|971,GB|United Kingdom|44,US|United States|1,UY|Uruguay|598,UZ|Uzbekistan|998,VU|Vanuatu|678,VA|Vatican City|39,VE|Venezuela|58,VN|Vietnam|84,YE|Yemen|967,ZM|Zambia|260,ZW|Zimbabwe|263";

export const COUNTRIES = RAW.split(",").map(r => { const [iso, name, dial] = r.split("|"); return { iso, name, dial }; });
export const flag = iso => iso.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
const byIso = Object.fromEntries(COUNTRIES.map(c => [c.iso, c]));
// longest dial codes first, so "+1876" (Jamaica) wins over "+1"
const byDial = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
const PREFER = { "1": "US", "7": "RU", "39": "IT", "44": "GB" };

const TZ = { "Africa/Lagos": "NG", "Africa/Accra": "GH", "Africa/Nairobi": "KE", "Africa/Johannesburg": "ZA", "Africa/Cairo": "EG", "Africa/Casablanca": "MA", "Africa/Algiers": "DZ", "Africa/Tunis": "TN",
  "Africa/Abidjan": "CI", "Africa/Dakar": "SN", "Africa/Douala": "CM", "Africa/Kinshasa": "CD", "Africa/Lubumbashi": "CD", "Africa/Kampala": "UG", "Africa/Dar_es_Salaam": "TZ", "Africa/Addis_Ababa": "ET",
  "Africa/Kigali": "RW", "Africa/Lusaka": "ZM", "Africa/Harare": "ZW", "Africa/Maputo": "MZ", "Africa/Luanda": "AO", "Africa/Porto-Novo": "BJ", "Africa/Lome": "TG", "Africa/Niamey": "NE", "Africa/Bamako": "ML",
  "Africa/Ouagadougou": "BF", "Africa/Freetown": "SL", "Africa/Monrovia": "LR", "Africa/Conakry": "GN", "Africa/Banjul": "GM", "Africa/Khartoum": "SD", "Africa/Windhoek": "NA", "Africa/Gaborone": "BW", "Africa/Libreville": "GA",
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Lisbon": "PT", "Europe/Zurich": "CH",
  "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Warsaw": "PL", "Europe/Istanbul": "TR", "Europe/Moscow": "RU", "Europe/Kyiv": "UA", "Europe/Kiev": "UA", "Europe/Athens": "GR",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US", "Pacific/Honolulu": "US", "America/Toronto": "CA", "America/Vancouver": "CA",
  "America/Mexico_City": "MX", "America/Sao_Paulo": "BR", "America/Argentina/Buenos_Aires": "AR", "America/Bogota": "CO", "America/Lima": "PE", "America/Santiago": "CL", "America/Jamaica": "JM", "America/Port_of_Spain": "TT",
  "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Qatar": "QA", "Asia/Kuwait": "KW", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK",
  "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Singapore": "SG", "Asia/Manila": "PH", "Asia/Jakarta": "ID", "Asia/Kuala_Lumpur": "MY", "Asia/Bangkok": "TH", "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Pacific/Auckland": "NZ" };
export function guessCountry() {
  try {
    const saved = localStorage.getItem("blocko.country");
    if (saved && byIso[saved]) return saved;
  } catch (e) {}
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const c = TZ[tz];
    if (c && byIso[c]) return c;
  } catch (e) {}
  for (const l of navigator.languages || [navigator.language || ""]) {
    const m = /-([A-Z]{2})$/i.exec(l || "");
    if (m && byIso[m[1].toUpperCase()]) return m[1].toUpperCase();
  }
  return "NG";
}

// split "+234 801..." into { iso, local }
export function parsePhone(value, fallbackIso) {
  const v = (value || "").trim();
  if (v.startsWith("+")) {
    const digits = v.slice(1).replace(/\D/g, "");
    const c = byDial.find(c => digits.startsWith(c.dial));
    if (c) {
      const fb = fallbackIso && byIso[fallbackIso];
      const iso = fb && fb.dial === c.dial ? fb.iso : (PREFER[c.dial] || c.iso);
      return { iso, local: digits.slice(c.dial.length) };
    }
  }
  return { iso: fallbackIso || guessCountry(), local: v.replace(/[^\d\s-]/g, "") };
}

// "0801 234 5678" in Nigeria -> "+234 8012345678"
export function formatPhone(iso, local) {
  const c = byIso[iso] || byIso.NG;
  let d = (local || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (d.startsWith(c.dial) && d.length > c.dial.length + 6) d = d.slice(c.dial.length);
  if (d.startsWith("0") && c.iso !== "IT") d = d.replace(/^0+/, "");
  return "+" + c.dial + " " + d;
}

export const phoneOk = v => { const d = (v || "").replace(/\D/g, ""); return d.length >= 7 && d.length <= 15; };

// h = the app's element helper
export function phoneField(h, { id, value, disabled, placeholder, onChange, className }) {
  const start = parsePhone(value, guessCountry());
  let iso = start.iso;
  const face = h("span", { class: "ph-face", "aria-hidden": "true" });
  const paint = () => { const c = byIso[iso]; face.replaceChildren(h("span", { class: "ph-flag" }, flag(iso)), h("span", { class: "ph-dial" }, "+" + c.dial), h("span", { class: "ph-caret" }, "▾")); };
  const sel = h("select", { class: "ph-sel", "aria-label": "Country", disabled,
    onchange: e => { iso = e.target.value; try { localStorage.setItem("blocko.country", iso); } catch (err) {} paint(); emit(); input.focus(); } },
    COUNTRIES.map(c => h("option", { value: c.iso, selected: c.iso === iso }, flag(c.iso) + "  " + c.name + "  (+" + c.dial + ")")));
  const input = h("input", { class: "input ph-num", id, type: "tel", inputMode: "tel", autocomplete: "tel-national", maxLength: 24, disabled, value: start.local, placeholder: placeholder || "Phone number",
    oninput: e => {
      const v = e.target.value;
      if (v.trim().startsWith("+") && v.replace(/\D/g, "").length >= 4) { const p = parsePhone(v, iso); if (p.iso !== iso || p.local) { iso = p.iso; sel.value = iso; e.target.value = p.local; paint(); } }
      emit();
    } });
  const emit = () => onChange && onChange(formatPhone(iso, input.value));
  paint();
  return h("div", { class: "ph" + (className ? " " + className : "") }, h("label", { class: "ph-pick" }, face, sel), input);
}
