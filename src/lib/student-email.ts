/**
 * Memorable login for a bulk-imported student: "firstname.initial",
 * e.g. "DEEKSHITHA M" -> "deekshitha.m", "GUDI ASHWITH KUMAR" -> "gudi.k".
 * The first word matches the generated password ("Deekshitha@1639"), so the
 * pair is easy to remember. Single-word names stay bare ("aarav").
 * On a clash, longer forms are tried before a number: ravi.k -> ravi.kumar ->
 * ravi.kumar.reddy -> ravi.k2 (common surnames like Reddy/Goud/Kumar).
 */
function nameWords(fullName: string): string[] {
  return fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // José -> jose
    .toLowerCase()
    .split(/[^a-z]+/) // "REDDY.S" -> reddy, s; drops digits/punctuation
    .filter(Boolean);
}

export function studentEmailLocal(fullName: string): string {
  const [first, ...rest] = nameWords(fullName);
  if (!first) return 'student';
  const last = rest[rest.length - 1];
  return last ? `${first}.${last[0]}` : first;
}

/** Email made unique against `taken` (lowercased full emails). */
export function uniqueStudentEmail(fullName: string, domain: string, taken: Set<string>): string {
  const words = nameWords(fullName);
  const base = studentEmailLocal(fullName);
  const longer = words.length > 1 ? [`${words[0]}.${words[words.length - 1]}`, words.join('.')] : [];
  for (const local of [base, ...longer]) {
    const email = `${local}@${domain}`;
    if (!taken.has(email)) return (taken.add(email), email);
  }
  let email = '';
  for (let n = 2; !email || taken.has(email); n++) email = `${base}${n}@${domain}`;
  taken.add(email);
  return email;
}
