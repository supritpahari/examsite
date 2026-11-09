/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
import LegalDoc from "../_components/LegalDoc";
import { loadSiteInfo, DEFAULT_SITE_INFO } from "@/lib/settings";

export default async function TermsOfServicePage() {
  const siteInfo = await loadSiteInfo().catch(() => DEFAULT_SITE_INFO);
  const contactEmail = siteInfo.email || DEFAULT_SITE_INFO.email;
  const contactPhone = siteInfo.phone || DEFAULT_SITE_INFO.phone;

  return (
    <LegalDoc title="Terms of service" updated="November 9, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of World of Physics, a practice
        rehearsal platform for the JEE and NEET computer-based test portals operated by
        Mr. Biman Dhawa. By accessing or using World of Physics you agree to these Terms.
      </p>

      <h2>1 · Use of the Service</h2>
      <ul>
        <li>World of Physics is provided for <strong>practice and preparation only</strong>.</li>
        <li>
          You must be at least 13 years old, or have parental permission, to use the
          service.
        </li>
        <li>
          You are responsible for keeping your phone number, OTP codes, and account
          credentials confidential.
        </li>
      </ul>

      <h2>2 · Account &amp; Sign-In</h2>
      <p>
        Student accounts use mobile phone number verification. You receive a one-time
        code by SMS to sign in. On supported browsers, your device may auto-fill the code
        (WebOTP). You may enter the code manually instead. By signing in you consent to
        receiving SMS messages for authentication. Standard carrier message rates may apply.
        Contact us at <a href={`mailto:${contactEmail}`}>{contactEmail}</a> or
        <a href={`tel:${contactPhone}`}>{contactPhone}</a> for sign-in issues.
      </p>

      <h2>3 · One Attempt Per Device</h2>
      <p>
        Each mock test may be attempted once per device. A device identifier stored in your
        browser enforces this limit. Attempts are tied to your phone-verified account where
        available. Creating multiple accounts or devices to bypass this limit is prohibited.
      </p>

      <h2>4 · Formula Sheet Purchases</h2>
      <p>
        Formula sheet PDFs are available for purchase. Payments are processed through our
        checkout integration. Purchases are tied to your phone-verified account and may be
        re-downloaded from your account page. All sales are final unless otherwise stated.
      </p>

      <h2>5 · Not an Official Portal</h2>
      <p>
        World of Physics is <strong>not affiliated with, endorsed by, or connected to</strong> the
        National Testing Agency (NTA) or any examination authority. It is an independent
        rehearsal tool designed to familiarize students with the CBT interface.
      </p>

      <h2>6 · Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service for any unlawful purpose.</li>
        <li>Attempt to disrupt, overload, or compromise the platform or other users.</li>
        <li>Copy, resell, or redistribute the content or software without permission.</li>
        <li>Impersonate others or misrepresent your affiliation.</li>
        <li>Use automated means to bypass sign-in, attempt limits, or purchase flows.</li>
      </ul>

      <h2>7 · Accounts</h2>
      <p>
        Where accounts are provided, you agree to supply accurate information and to keep
        it up to date. We may suspend or terminate access that violates these Terms.
      </p>

      <h2>8 · Intellectual Property</h2>
      <p>
        The World of Physics design, software, and original content are owned by Mr. Biman Dhawa
        and its developers. Practice questions are provided for study; respect any
        third-party rights in source material.
      </p>

      <h2>9 · Disclaimers</h2>
      <p>
        The service is provided &quot;as is&quot; without warranties of any kind. We do not
        guarantee that practice scores predict actual exam performance, nor that the portal
        exactly matches the official interface at all times. SMS delivery depends on your
        carrier and network; we are not responsible for delayed or undelivered codes.
      </p>

      <h2>10 · Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, World of Physics and its operator shall not be
        liable for any indirect, incidental, or consequential damages arising from your use
        of the service.
      </p>

      <h2>11 · Termination</h2>
      <p>
        You may stop using World of Physics at any time. We may discontinue or modify the service,
        or end your access, with or without notice, for any reason.
      </p>

      <h2>12 · Changes to These Terms</h2>
      <p>
        We may revise these Terms periodically. Continued use after changes constitutes
        acceptance of the updated Terms.
      </p>

      <h2>13 · Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a> or call
        <a href={`tel:${contactPhone}`}>{contactPhone}</a>, or write to Mr. Biman Dhawa,
        Belda, India.
      </p>
    </LegalDoc>
  );
}
