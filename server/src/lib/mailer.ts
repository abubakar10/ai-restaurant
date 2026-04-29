import nodemailer from "nodemailer";

type PoMailLine = {
  sku: string;
  name: string;
  vendorName: string | null;
  qty: number;
  unit: string;
  unitCost: number | null;
};

export type SendSupplierPoEmailInput = {
  poNumber: string;
  supplierName: string;
  supplierCode: string | null;
  approvedAtIso: string;
  lines: PoMailLine[];
  totalEstimated: number;
  /** Full URL to supplier portal (new tab). */
  portalUrl: string;
  /** Resolved recipient list for display + send. */
  to: string[];
};

type SendPoEmailResult = {
  sent: boolean;
  /** Comma-separated list (for API/UI). */
  to: string;
  mode: "smtp" | "simulated";
  error?: string;
};

const SANTOS_ORDER_EMAIL = "anthonys2amartina@gmail.com";

/** One or more test inboxes: comma or semicolon separated — BCC when SMTP sends real supplier mail. */
function testRecipients(): string[] {
  const raw =
    process.env.PO_TEST_RECIPIENT_EMAIL?.trim() || "";
  const parts = raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : ["abubakarr1011@gmail.com"];
}

function senderEmail(): string {
  return (
    process.env.PO_SENDER_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "noreply@example.com"
  );
}

/** Santos / internal production: client-specified inbox for PO notifications. */
export function resolveSupplierPoRecipients(input: {
  supplierCode: string | null;
  supplierName: string;
  contactEmail: string | null;
}): string[] {
  const code = (input.supplierCode ?? "").toUpperCase();
  const name = input.supplierName.toLowerCase();
  if (code === "SUP001" || name.includes("santos")) {
    return [SANTOS_ORDER_EMAIL];
  }
  if (input.contactEmail?.includes("@")) {
    return [input.contactEmail.trim()];
  }
  return testRecipients();
}

function buildText(input: SendSupplierPoEmailInput): string {
  const lines = input.lines
    .map((l) => {
      const cost = l.unitCost == null ? "-" : l.unitCost.toFixed(2);
      return `- ${l.sku} | ${l.name} | Qty: ${l.qty} ${l.unit} | Unit Cost: ${cost} | Vendor: ${l.vendorName ?? "-"}`;
    })
    .join("\n");
  return [
    `Purchase order ${input.poNumber} — ${input.supplierName}`,
    `Supervisor approved at: ${new Date(input.approvedAtIso).toLocaleString()}`,
    "",
    "Please review and confirm quantities on the supplier portal:",
    input.portalUrl,
    "",
    "Lines:",
    lines || "-",
    "",
    `Estimated total: ${input.totalEstimated.toFixed(2)}`,
  ].join("\n");
}

function buildHtml(input: SendSupplierPoEmailInput): string {
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
    <h2 style="margin:0 0 8px;">PO ${input.poNumber} — ${input.supplierName}</h2>
    <p style="margin:0 0 14px;">Supervisor approved at ${new Date(input.approvedAtIso).toLocaleString()}</p>
    <p style="margin:0 0 14px;">
      <a href="${input.portalUrl}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
        Open supplier portal
      </a>
    </p>
    <p style="margin:0 0 14px;font-size:13px;color:#444;">Opens in a new window. You can adjust line quantities to match stock and add notes.</p>
    <table style="border-collapse:collapse;font-size:14px;">
      <thead>
        <tr>
          <th style="padding:6px 8px;border:1px solid #ddd;background:#f4f4f4;">SKU</th>
          <th style="padding:6px 8px;border:1px solid #ddd;background:#f4f4f4;">Item</th>
          <th style="padding:6px 8px;border:1px solid #ddd;background:#f4f4f4;">Order qty</th>
          <th style="padding:6px 8px;border:1px solid #ddd;background:#f4f4f4;">Unit cost</th>
          <th style="padding:6px 8px;border:1px solid #ddd;background:#f4f4f4;">Vendor</th>
        </tr>
      </thead>
      <tbody>${rowHtml}</tbody>
    </table>
    <p style="margin-top:14px;"><strong>Estimated total:</strong> ${input.totalEstimated.toFixed(2)}</p>
  </body>
</html>`;
}

export async function sendSupplierPoEmail(
  input: SendSupplierPoEmailInput
): Promise<SendPoEmailResult> {
  const toList = input.to.filter(Boolean);
  const toDisplay = toList.join(", ");
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const bcc = testRecipients().filter((e) => !toList.includes(e));

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log(
      `[mail:simulated] PO ${input.poNumber} → ${toDisplay}. Portal: ${input.portalUrl}. Configure SMTP_* for real delivery.`
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
      bcc: bcc.length ? bcc : undefined,
      subject: `PO ${input.poNumber} — please confirm (${input.supplierName})`,
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
