/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
import LegalDoc from "../_components/LegalDoc";
import { loadSiteInfo, DEFAULT_SITE_INFO } from "@/lib/settings";

export default async function PrivacyPolicyPage() {
  const siteInfo = await loadSiteInfo().catch(() => DEFAULT_SITE_INFO);
  const contactEmail = siteInfo.email || DEFAULT_SITE_INFO.email;
  const contactPhone = siteInfo.phone || DEFAULT_SITE_INFO.phone;

  return (
    <LegalDoc title="Privacy policy" updated="November 9, 2026">
      <p>
        World of Physics (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is a practice
        rehearsal platform for the JEE and NEET computer-based test portals, operated by
        Mr. Biman Dhawa. This Privacy Policy explains what information we collect, how we
        use it, and the choices you have. By using World of Physics you agree to the practices
        described here.
      </p>

      <h2>1 · Information We Collect</h2>
      <p>We collect only what is needed to run mock examinations:</p>
      <ul>
        <li>
          <strong>Mobile phone number</strong> (&quot;+91…&quot;) used for one-time-password
          sign-in so you can start a test, buy formula sheets, and access your account.
        </li>
        <li>
          <strong>Display name</strong> you choose after first sign-in. It pre-fills when you
          take a test and appears on your attempt records. You can change it anytime on your
          account page.
        </li>
        <li>
          <strong>Test codes and session data</strong> you enter to start a mock exam.
        </li>
        <li>
          <strong>Response activity</strong> such as answers selected, questions marked for
          review, and time spent — stored per practice session and linked to your phone number.
        </li>
        <li>
          <strong>Formula sheet purchases</strong> — which sheets you bought, when, and the
          amount paid. Purchase receipts are tied to your phone-verified account.
        </li>
        <li>
          <strong>Device identifier</strong> stored in your browser (localStorage) to enforce
          one attempt per device per test.
        </li>
        <li>
          <strong>Technical data</strong> like browser type, device, and usage logs for
          diagnostics and security.
        </li>
      </ul>

      <h2>2 · How We Use Information</h2>
      <ul>
        <li>Send you a one-time SMS code to verify your phone number before a test.</li>
        <li>Deliver and score mock tests, and show you your performance.</li>
        <li>Let you download formula sheets you purchased.</li>
        <li>Improve the realism and reliability of the practice portal.</li>
        <li>Communicate with you about sessions, updates, and support.</li>
        <li>Prevent abuse, cheating, and unauthorized access (including one-attempt-per-device
          limits).</li>
      </ul>

      <h2>3 · Service Providers</h2>
      <p>
        We do not sell your personal data. We use Firebase (Google) for authentication,
        SMS delivery, file storage, and database services. Your phone number and OTP codes
        are handled by Firebase under its own terms. Other providers may help with hosting,
        analytics, and payments under confidentiality obligations, or when required by law.
      </p>

      <h2>4 · SMS &amp; WebOTP</h2>
      <p>
        When you sign in, we send an SMS to your phone number through Firebase. On supported
        browsers (Chrome on Android), your browser may automatically read the incoming code
        (WebOTP) so you don&apos;t have to type it. You can always enter the code manually
        instead. Standard SMS charges from your carrier may apply.
      </p>

      <h2>5 · Cookies &amp; Local Storage</h2>
      <p>
        We use cookies and browser local storage to keep you signed in, remember your
        preferences, store your device identifier, and understand usage. You can disable
        cookies in your browser, but some features (including staying signed in) may not work.
      </p>

      <h2>6 · Data Retention</h2>
      <p>
        We keep practice and account data for as long as your account is active or as needed
        to provide the service. You may request deletion of your account data at any time.
        Deleted accounts cannot be restored, and linked test attempts are anonymized.
      </p>

      <h2>7 · Your Rights</h2>
      <p>
        Depending on your location, you may have the right to access, correct, export, or
        delete your personal data, and to object to certain processing. To exercise these
        rights, contact us at <a href={`mailto:${contactEmail}`}>{contactEmail}</a> or
        call <a href={`tel:${contactPhone}`}>{contactPhone}</a>.
      </p>

      <h2>8 · Children&apos;s Privacy</h2>
      <p>
        World of Physics is intended for students preparing for entrance exams. We do not
        knowingly collect personal data from children without parental consent where required
        by law.
      </p>

      <h2>9 · Security</h2>
      <p>
        We use reasonable administrative and technical measures to protect your data,
        including Firebase authentication and storage security rules. No method of
        transmission or storage is completely secure, so we cannot guarantee absolute
        security.
      </p>

      <h2>10 · Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be posted
        here with a revised &quot;Last updated&quot; date.
      </p>

      <h2>11 · Contact</h2>
      <p>
        Questions about this policy? Email{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a> or write to Mr. Biman
        Dhawa, Belda, India. Phone: <a href={`tel:${contactPhone}`}>{contactPhone}</a>.
      </p>
    </LegalDoc>
  );
}
