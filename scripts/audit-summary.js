let d = "";
process.stdin.on("data", (c) => (d += c));
process.stdin.on("end", () => {
  const j = JSON.parse(d);
  for (const k in j.vulnerabilities) {
    const v = j.vulnerabilities[k];
    if (v.severity === "high" || v.severity === "critical") {
      console.log(k, v.severity, v.isDirect ? "DIRECT" : "transitive", v.fixAvailable ? "FIXABLE" : "NO-FIX");
    }
  }
});