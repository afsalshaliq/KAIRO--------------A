/** Open a clean, printable window for a resource. Used by worksheets/quizzes/activities. */
export function printHtml(title: string, bodyHtml: string) {
  const w = window.open("", "_blank", "width=800,height=1000");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      body{font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;margin:40px;line-height:1.5}
      h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:18px 0 8px}
      .head{text-align:center;border-bottom:2px solid #B21E3B;padding-bottom:8px;margin-bottom:16px}
      .fields{display:flex;gap:24px;font-size:13px;margin:12px 0}
      .q{margin:10px 0} .opt{margin-left:18px} .line{border-bottom:1px solid #999;height:22px;margin:6px 0}
      ol,ul{margin:6px 0 6px 20px} .muted{color:#666;font-size:12px}
      @media print{button{display:none}}
    </style></head><body>${bodyHtml}
    <script>setTimeout(()=>window.print(),250)</script></body></html>`);
  w.document.close();
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
