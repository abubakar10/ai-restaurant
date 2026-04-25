import nodemailer from "nodemailer";

type PoMailLine = {
  sku: string;
  name: string;
  vendorName: string | null;
  qty: number;
  unit: string;
  unitCost: number | null;
};

type SendPoEmailInput = {
  poNumber: string;
  approvedAtIso: string;
  lines: PoMailLine[];
  totalEstimated: number;
};

type SendPoEmailResult = {
  sent: boolean;
  /** Comma-separated list (for API/UI); actual send uses the same addresses. */
  to: string;
  mode: "smtp" | "simulated";
  error?: string;
};

/** One or more test inboxes: comma or semicolon separated. */
function testRecipients(): string[] {
  const raw =
    process.env.PO_TEST_RECIPIENT_EMAIL?.trim() || "abubakarr1011@gmail.com";
  const parts = raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : ["abubakarr1011@gmail.com"];
}

function senderEmail(): string {
  return process.env.PO_SENDER_EMAIL?.trim() || process.env.SMTP_USER?.trim() || "noreply@example.com";
}

function buildText(input: SendPoEmailInput): string {
  const lines = input.lines
    .map((l) => {
      const cost = l.unitCost == null ? "-" : l.unitCost.toFixed(2);
      return `- ${l.sku} | ${l.name} | Qty: ${l.qty} ${l.unit} | Unit Cost: ${cost} | Vendor: ${l.vendorName ?? "-"}`;
    })
    .join("\n");
  return [
    `PO Approved: ${input.poNumber}`,
    `Approved At: ${new Date(input.approvedAtIso).toLocaleString()}`,
    "",
    "Approved Lines:",
    lines || "-",
    "",
    `Estimated Total: ${input.totalEstimated.toFixed(2)}`,
    "",
    "Note: Test mode routes supplier notifications to the configured test recipient list.",
  ].join("\n");
}

function buildHtml(input: SendPoEmailInput): string {
  const rowHtml = input.lines
    .map((l) => {
      const cost = l.unitCost == null ? "-" : l.unitCost.toFixed(2);
      return `<tr>
        <td style="padding:6px 8px;border:1px solid #ddd;">${l.sku}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${l.name}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${l.qty} ${l.unit}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${cost}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${l.vendorName ?? "-"}</td>
      </tr>`;
    })
    .join("");
  return `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;color:#111;">
    <h2 style="margin:0 0 8px;">PO Approved: ${input.poNumber}</h2>
    <p style="margin:0 0 14px;">Approved at ${new Date(input.approvedAtIso).toLocaleString()}</p>
    <table style="border-collapse:collapse;font-size:14px;">
      <thead>
        <tr>
          <th style="padding:6px 8px;border:1px solid #ddd;background:#f4f4f4;">SKU</th>
          <th style="padding:6px 8px;border:1px solid #ddd;background:#f4f4f4;">Ingredient</th>
          <th style="padding:6px 8px;border:1px solid #ddd;background:#f4f4f4;">Approved Qty</th>
          <th style="padding:6px 8px;border:1px solid #ddd;background:#f4f4f4;">Unit Cost</th>
          <th style="padding:6px 8px;border:1px solid #ddd;background:#f4f4f4;">Vendor</th>
        </tr>
      </thead>
      <tbody>${rowHtml}</tbody>
    </table>
    <p style="margin-top:14px;"><strong>Estimated Total:</strong> ${input.totalEstimated.toFixed(2)}</p>
    <p style="font-size:12px;color:#555;">Test mode routes supplier notifications to the configured test recipient list.</p>
  </body>
</html>`;
}

export async function sendApprovedPoEmail(
  input: SendPoEmailInput
): Promise<SendPoEmailResult> {
  const toList = testRecipients();
  const toDisplay = toList.join(", ");
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  // If SMTP is not configured yet, simulate send but keep PO approval successful.
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log(
      `[mail:simulated] would send approved PO ${input.poNumber} to: ${toDisplay}. Configure SMTP_* in server/.env to enable real sending.`
    );
    return { sent: false, to: toDisplay, mode: "simulated" };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.sendMail({
      from: senderEmail(),
      to: toList,
      subject: `PO Approved - ${input.poNumber}`,
      text: buildText(input),
      html: buildHtml(input),
    });
    return { sent: true, to: toDisplay, mode: "smtp" };
  } catch (error) {
    return {
      sent: false,
      to: toDisplay,
      mode: "smtp",
      error: error instanceof Error ? error.message : "Unknown mail error",
    };
  }
}

