import React from "react";
import SimpleLayout from "@/components/layouts/Simple";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";

const sections = [
  "Personal information we collect",
  "How we use your personal information",
  "How we share your personal information",
  "Your choices",
  "Other sites and services",
  "Security",
  "International data transfer",
  "Children",
  "Changes to this Privacy Policy",
  "How to contact us",
];

export default function Privacy() {
  return (
    <SimpleLayout>
      <section className="prose [&_a]:break-all">
        <h1>Privacy Policy</h1>
        <p>Effective as of May 9, 2022.</p>
        <p>
          This Privacy Policy describes how Gumroad, Inc. ("<strong>Flexile</strong>," "<strong>we</strong>", "
          <strong>us</strong>" or "<strong>our</strong>") handles personal information that we collect through our
          digital properties that link to this Privacy Policy, including the Flexile website (collectively, the "
          <strong>Service</strong>"), as well as through other activities described in this Privacy Policy.
        </p>
        <div role="navigation" className={cn("grid gap-1", "not-prose")}>
          {sections.map((section, index) => (
            <a key={index} href={`#jump_${index + 1}`} className="flex items-center text-gray-500 no-underline">
              <Badge variant="outline" className="mr-1 shrink-0">
                {index + 1}
              </Badge>
              <span className="truncate">{section}</span>
            </a>
          ))}
        </div>
        <p>
          We may provide additional or supplemental privacy policies to individuals for specific products or services
          that we offer at the time we collect personal information.
        </p>
        <p>
          Flexile provides a platform for onboarding and managing independent contractors to enterprise customers. This
          Privacy Policy does not apply to information that we process on behalf of our enterprise customers (such as
          businesses and other organizations) while providing the Flexile platform and services to them, such as
          contractor contact information, billing information, or hourly time data. Our use of this information is
          restricted by our agreements with such customers. If you have concerns regarding personal information that we
          process on behalf of an enterprise customer, please direct your concerns to that enterprise customer.
        </p>
        <h2 id="jump_1">Personal information we collect</h2>
        <p>
          <strong>Information you provide to us. </strong>Personal information you may provide to us through the Service
          or otherwise includes:
        </p>
        <ul>
          <li>
            <strong>Contact data</strong>, such as your first and last name, email address, billing and mailing
            addresses, professional title and company name, and phone number.
          </li>
          <li>
            <strong>Profile data</strong>, such as the username and password that you may set to online account on the
            Service, date of birth, and any other information that you add to your account profile.
          </li>
          <li>
            <strong>Communications data</strong>, based on our exchanges with you, including when you contact us through
            the Service, social media, or otherwise.
          </li>
          <li>
            <strong>Payment and transactional data</strong>, such as information relating to or needed to complete your
            orders and/or payments on or through the Service (including payment card information and billing
            information), and your purchase history.
          </li>
          <li>
            <strong>Marketing data</strong>, such as your preferences for receiving our marketing communications and
            details about your engagement with them.
          </li>
          <li>
            <strong>Other data </strong>not specifically listed here, which we will use as described in this Privacy
            Policy or as otherwise disclosed at the time of collection.
          </li>
        </ul>
        <p />
        <p>
          <strong>Automatic data collection. </strong>We, our service providers, and our business partners may
          automatically log information about you, your computer or mobile device, and your interaction over time with
          the Service, our communications and other online services, such as:
        </p>
        <ul>
          <li>
            <strong>Device data</strong>, such as your computer or mobile device&rsquo;s operating system type and
            version, manufacturer and model, browser type, screen resolution, RAM and disk size, CPU usage, device type
            (e.g., phone, tablet), IP address, unique identifiers (including identifiers used for advertising purposes),
            language settings, mobile device carrier, radio/network information (e.g., Wi-Fi, LTE, 3G), and general
            location information such as city, state or geographic area.
          </li>
          <li>
            <strong>Online activity data</strong>, such as pages or screens you viewed, how long you spent on a page or
            screen, the website you visited before browsing to the Service, navigation paths between pages or screens,
            information about your activity on a page or screen, access times and duration of access, and whether you
            have opened our emails or clicked links within them.
          </li>
        </ul>
        <p>
          <strong>Cookies and similar technologies. </strong>Some of the automatic collection described above is
          facilitated by the following technologies:
        </p>
        <ul>
          <li>
            <strong>Cookies</strong>, which are small text files that websites store on user devices and that allow web
            servers to record users&rsquo; web browsing activities and remember their submissions, preferences, and
            login status as they navigate a site. Cookies used on our sites include both "session cookies" that are
            deleted when a session ends, "persistent cookies" that remain longer, "first party" cookies that we place
            and "third party" cookies that our third-party business partners and service providers place.
          </li>
          <li>
            <strong>Local storage technologies</strong>, like HTML5, that provide cookie-equivalent functionality but
            can store larger amounts of data on your device outside of your browser in connection with specific
            applications.
          </li>
          <li>
            <strong>Web beacons</strong>, also known as pixel tags or clear GIFs, which are used to demonstrate that a
            webpage or email was accessed or opened, or that certain content was viewed or clicked.
          </li>
        </ul>
        <p>
          <strong>Data about others. </strong>Users of the Service may have the opportunity to refer friends or other
          contacts to us and share their contact information with us. Please do not refer someone to us or share their
          contact information with us unless you have their permission to do so.
        </p>
        <p />
        <h2 id="jump_2">How we use your personal information</h2>
        <p>
          We may use your personal information for the following purposes or as otherwise described at the time of
          collection:
        </p>
        <p>
          <strong>Service delivery and business operations. </strong>We may use your personal information to:
        </p>
        <ul>
          <li>provide, operate and improve the Service and our business;</li>
          <li>establish and maintain your user profile on the Service;</li>
          <li>
            enable security features of the Service, such as by sending you security codes via email or SMS, and
            remembering devices from which you have previously logged in;
          </li>
          <li>
            communicate with you about the Service, including by sending announcements, updates, security alerts, and
            support and administrative messages;
          </li>
          <li>
            understand your needs and interests, and personalize your experience with the Service and our
            communications; and
          </li>
          <li>provide support for the Service, and respond to your requests, questions and feedback.</li>
        </ul>
        <p>
          <strong>Research and development. </strong>We may use your personal information for research and development
          purposes, including to analyze and improve the Service and our business. As part of these activities, we may
          create aggregated, de-identified and/or anonymized data from personal information we collect. We make personal
          information into de-identified or anonymized data by removing information that makes the data personally
          identifiable to you. We may use this aggregated, de-identified or otherwise anonymized data and share it with
          third parties for our lawful business purposes, including to analyze and improve the Service and promote our
          business.
        </p>
        <p>
          <strong>Marketing and advertising. </strong>We, our service providers and our third-party advertising partners
          may collect and use your personal information for marketing and advertising purposes:
        </p>
        <ul>
          <li>
            <strong>Direct marketing. </strong>We may send you direct marketing communications. You may opt-out of our
            marketing communications as described in the Opt-out of marketing section below.
          </li>
          <li>
            <strong>Interest-based advertising. </strong>Our third-party advertising partners may use cookies and
            similar technologies to collect information about your interaction (including the data described in the
            automatic data collection section above) with the Service, our communications and other online services over
            time, and use that information to serve online ads that they think will interest you. This is called
            interest-based advertising. We may also share information about our users with these companies to facilitate
            interest-based advertising to those or similar users on other online platforms. You can learn more about
            your choices for limiting interest-based advertising in the Advertising choices section below.
          </li>
        </ul>
        <p>
          <strong>Compliance and protection. </strong>We may use your personal information to:
        </p>
        <ul>
          <li>
            comply with applicable laws, lawful requests, and legal process, such as to respond to subpoenas or requests
            from government authorities;
          </li>
          <li>
            protect our, your or others&rsquo; rights, privacy, safety or property (including by making and defending
            legal claims);
          </li>
          <li>
            audit our internal processes for compliance with legal and contractual requirements or our internal
            policies;
          </li>
          <li>enforce the terms and conditions that govern the Service; and</li>
          <li>
            prevent, identify, investigate and deter fraudulent, harmful, unauthorized, unethical or illegal activity,
            including cyberattacks and identity theft.
          </li>
        </ul>
        <p>
          <strong>With your consent. </strong>In some cases, we may specifically ask for your consent to collect, use or
          share your personal information, such as when required by law.
        </p>
        <p>
          <strong>Cookies and similar technologies. </strong>In addition to the other uses included in this section, we
          may use the Cookies and similar technologies described above for the following purposes:
        </p>
        <ul>
          <li>
            <strong>Technical operation</strong>. To allow the technical operation of the Service, such as by
            remembering your selections and preferences as you navigate the site, and whether you are logged in when you
            visit password protected areas of the Service.
          </li>
          <li>
            <strong>Functionality</strong>. To enhance the performance and functionality of our services.
          </li>
          <li>
            <strong>Advertising</strong>. To help our third-party advertising partners collect information about how you
            use the Service and other online services over time, which they use to show you ads on other online services
            they believe will interest you and measure how the ads perform.
          </li>
          <li>
            <strong>Analytics</strong>. To help us understand user activity on the Service, including which pages are
            most and least visited and how visitors move around the Service, as well as user interactions with our
            emails. For example, we use Google Analytics for this purpose. You can learn more about Google Analytics and
            how to prevent the use of Google Analytics relating to your use of our sites here:{" "}
            <a href="https://tools.google.com/dlpage/gaoptout?hl=en">https://tools.google.com/dlpage/gaoptout?hl=en</a>.
          </li>
        </ul>
        <p>
          <strong>Retention. </strong>We generally retain personal information to fulfill the purposes for which we
          collected it, including for the purposes of satisfying any legal, accounting, or reporting requirements, to
          establish or defend legal claims, or for fraud prevention purposes. To determine the appropriate retention
          period for personal information, we may consider factors such as the amount, nature, and sensitivity of the
          personal information, the potential risk of harm from unauthorized use or disclosure of your personal
          information, the purposes for which we process your personal information and whether we can achieve those
          purposes through other means, and the applicable legal requirements.
        </p>
        <p>
          When we no longer require the personal information we have collected about you, we may either delete it,
          anonymize it, or isolate it from further processing.
        </p>
        <h2 id="jump_3">How we share your personal information</h2>
        <p>
          We may share your personal information with the following parties and as otherwise described in this Privacy
          Policy or at the time of collection.
        </p>
        <p>
          <strong>Affiliates. </strong>Our corporate parent, subsidiaries, and affiliates, for purposes consistent with
          this Privacy Policy.
        </p>
        <p>
          <strong>Service providers.</strong> Third parties that provide services on our behalf or help us operate the
          Service or our business (such as hosting, information technology, customer support, email delivery, marketing,
          consumer research and website analytics).
        </p>
        <p>
          <strong>Payment processors</strong>. Any payment card information you use to make a purchase on the Service is
          collected and processed directly by our payment processors, such as Stripe. Stripe may use your payment data
          in accordance with its privacy policy, <a href="https://stripe.com/privacy">https://stripe.com/privacy</a>.
        </p>
        <p>
          <strong>Advertising partners. </strong>Third-party advertising companies for the interest-based advertising
          purposes described above.
        </p>
        <p>
          <strong>Professional advisors.</strong> Professional advisors, such as lawyers, auditors, bankers and
          insurers, where necessary in the course of the professional services that they render to us.
        </p>
        <p>
          <strong>Authorities and others. </strong>Law enforcement, government authorities, and private parties, as we
          believe in good faith to be necessary or appropriate for the compliance and protection purposes described
          above.
        </p>
        <p>
          <strong>Business transferees.</strong> Acquirers and other relevant participants in business transactions (or
          negotiations of or due diligence for such transactions) involving a corporate divestiture, merger,
          consolidation, acquisition, reorganization, sale or other disposition of all or any portion of the business or
          assets of, or equity interests in, Flexile or our affiliates (including, in connection with a bankruptcy or
          similar proceedings).
        </p>
        <h2 id="jump_4">Your choices</h2>
        <p>
          <strong>Access or update your information. I</strong>f you have registered for an account with us through the
          Service, you may review and update certain account information by logging into the account.
        </p>
        <p>
          <strong>Opt-out of marketing communications. </strong>You may opt-out of marketing-related emails by following
          the opt-out or unsubscribe instructions at the bottom of the email, or by contacting us at hi@flexile.com.
          Please note that if you choose to opt-out of marketing-related emails, you may continue to receive
          service-related and other non-marketing emails.
        </p>
        <p>
          <strong>Advertising choices. </strong>You may be able to limit use of your information for interest-based
          advertising through the following settings/options/tools:
        </p>
        <ul>
          <li>
            <strong>Browser settings. </strong>Changing your internet web browser settings to block third-party cookies.
          </li>
          <li>
            <strong>Privacy browsers/plug-ins. </strong>Using privacy browsers and/or ad-blocking browser plug-ins that
            let you block tracking technologies.
          </li>
          <li>
            <strong>Platform settings. </strong>Google and Facebook offer opt-out features that let you opt-out of use
            of your information for interest-based advertising. You may be able to exercise that option at the following
            websites:
            <ul>
              <li>
                Google: <a href="https://adssettings.google.com/">https://adssettings.google.com/</a>
              </li>
              <li>
                Facebook: <a href="https://www.facebook.com/about/ads">https://www.facebook.com/about/ads</a>
              </li>
            </ul>
          </li>
          <li>
            <strong>Ad industry tools. </strong>Opting out of interest-based ads from companies that participate in the
            following industry opt-out programs:
            <ul>
              <li>
                Network Advertising Initiative:
                <a href="http://www.networkadvertising.org/managing/opt_out.asp">
                  http://www.networkadvertising.org/managing/opt_out.asp
                </a>
              </li>
              <li>Digital Advertising Alliance: optout.aboutads.info.</li>
            </ul>
          </li>
        </ul>
        <p>
          You will need to apply these opt-out settings on each device and browser from which you wish to limit the use
          of your information for interest-based advertising purposes.
        </p>
        <p>
          We cannot offer any assurances as to whether the companies we work with participate in the opt-out programs
          described above.
        </p>
        <p>
          <strong>Do Not Track. </strong>Some Internet browsers may be configured to send "Do Not Track" signals to the
          online services that you visit. We currently do not respond to "Do Not Track" or similar signals. To find out
          more about "Do Not Track," please visit <a href="http://www.allaboutdnt.com">http://www.allaboutdnt.com</a>.
        </p>
        <p>
          <strong>Declining to provide information. </strong>We need to collect personal information to provide certain
          services. If you do not provide the information we identify as required or mandatory, we may not be able to
          provide those services.
        </p>
        <p>
          <strong>Delete your content or close your account.</strong> You can choose to delete certain content through
          your account. If you wish to request to close your account, please contact us at
          <a href="mailto:support@flexile.com">support@flexile.com</a>.
        </p>
        <p />
        <h2 id="jump_5">Other sites and services</h2>
        <p>
          The Service may contain links to websites, mobile applications, and other online services operated by third
          parties. In addition, our content may be integrated into web pages or other online services that are not
          associated with us. These links and integrations are not an endorsement of, or representation that we are
          affiliated with, any third party. We do not control websites, mobile applications or online services operated
          by third parties, and we are not responsible for their actions. We encourage you to read the privacy policies
          of the other websites, mobile applications and online services you use.
        </p>
        <h2 id="jump_6">Security</h2>
        <p>
          We employ a number of technical, organizational and physical safeguards designed to protect the personal
          information we collect. However, security risk is inherent in all internet and information technologies and we
          cannot guarantee the security of your personal information.
        </p>
        <h2 id="jump_7">International data transfer</h2>
        <p>
          We are headquartered in the United States and may use service providers that operate in other countries. Your
          personal information may be transferred to the United States or other locations where privacy laws may not be
          as protective as those in your state, province, or country.
        </p>
        <h2 id="jump_8">Children</h2>
        <p>
          The Service is not intended for use by anyone under 16 years of age. If you are a parent or guardian of a
          child from whom you believe we have collected personal information in a manner prohibited by law, please
          contact us at hi@flexile.com. If we learn that we have collected personal information through the Service from
          a child without the consent of the child&rsquo;s parent or guardian as required by law, we will comply with
          applicable legal requirements to delete the information.
        </p>
        <h2 id="jump_9">Changes to this Privacy Policy</h2>
        <p>
          We reserve the right to modify this Privacy Policy at any time. If we make material changes to this Privacy
          Policy, we will notify you by updating the date of this Privacy Policy and posting it on the Service or other
          appropriate means. Any modifications to this Privacy Policy will be effective upon our posting the modified
          version (or as otherwise indicated at the time of posting). In all cases, your use of the Service after the
          effective date of any modified Privacy Policy indicates your acknowledgment that the modified Privacy Policy
          applies to your interactions with the Service and our business.
        </p>
        <h2 id="jump_10">How to contact us</h2>
        <p>
          Email: <a href="mailto:support@flexile.com">support@flexile.com</a>
        </p>
      </section>
    </SimpleLayout>
  );
}
