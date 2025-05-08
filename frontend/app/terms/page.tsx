import React from "react";
import Jumper from "@/components/Jumper";
import SimpleLayout from "@/components/layouts/Simple";

const sections = [
  "Definitions",
  "Services",
  "Restrictions",
  "Relationship with Gumroad",
  "Accounts",
  "Ownership",
  "Investigations",
  "Interactions with other users",
  "Fees",
  "Confidential information",
  "No solicitation",
  "Non-Circumvention",
  "Indemnification",
  "Disclaimer of warranties",
  "Limitation of liability",
  "Term and termination",
  "Release",
  "Dispute resolution",
  "Construction",
  "General provisions",
];

export default function Terms() {
  return (
    <SimpleLayout>
      <section className="prose">
        <h1>Terms of Service Agreement</h1>
        <p>
          This Terms of Service Agreement ("<strong>Agreement</strong>") is for Customers and Contractors (defined
          below) ("<strong>You</strong>" as applicable), and governs Your use of the Flexile platform (the "
          <strong>Platform</strong>"), which provides managed services for companies ("<strong>Customers</strong>")
          engaging independent, professional contractors ("<strong>Contractors</strong>") to provide services for them.
          Accepting the terms and conditions of this Agreement will allow Customers and Contractors to use the Platform
          in the manner set forth herein. To engage a Contractor (if You are a Customer), or be engaged by a Customer
          (if You are a Contractor), as applicable, to provide Contractor Services (defined below), Customer and
          Contractor must also agree to the terms of a separate independent contractor agreement (the "
          <strong>IC Agreement</strong>").
        </p>
        <Jumper sections={sections} className="not-prose" />
        <p>
          TO ACCESS AND USE THE FLEXILE PLATFORM, YOU MUST REVIEW AND ACCEPT THE TERMS OF THIS AGREEMENT BY CLICKING BY
          CLICKING THE "CONTINUE" BUTTON DURING THE SIGNING UP PROCESS.. ONCE ACCEPTED, THIS AGREEMENT BECOMES A BINDING
          LEGAL COMMITMENT BETWEEN YOU AND GUMROAD, INC. ("
          <strong>GUMROAD</strong>"). YOU REPRESENT THAT (1) YOU HAVE READ, UNDERSTAND, AND AGREE TO BE BOUND BY THE
          TERMS OF THIS AGREEMENT, (2) YOU ARE OF LEGAL AGE TO FORM A BINDING CONTRACT WITH GUMROAD, AND (3) YOU HAVE
          THE AUTHORITY TO ENTER INTO THE AGREEMENT ON BEHALF OF THE CUSTOMER OR CONTRACTOR (AS APPLICABLE) YOU HAVE
          NAMED AS THE USER (AND, IF YOU ARE ENTERING INTO THIS AGREEMENT AS A REPRESENTATIVE, AGENT OR EMPLOYEE THEREOF
          NAMED AS USER, YOU HAVE THE RIGHT TO BIND THAT COMPANY TO THE TERMS OF THIS AGREEMENT). THE TERM "
          <strong>YOU</strong>" REFERS TO THE INDIVIDUAL OR LEGAL ENTITY, AS APPLICABLE, IDENTIFIED AS THE USER WHEN YOU
          REGISTER. IF YOU DO NOT AGREE TO BE BOUND BY THESE TERMS, YOU SHOULD NOT CLICK THE "I ACCEPT" BUTTON.
        </p>
        <ol>
          <li id="jump_1">
            <strong>DEFINITIONS</strong>. The following terms shall have the meanings set forth below. Capitalized terms
            not defined in this Section shall have the meanings assigned to them where used in this Agreement.
            <br />"<strong>Contractor</strong>" means an individual or entity that provides Contractor Services to
            Customer.
            <br />"<strong>Contractor Fees</strong>" means the compensation Customer owes to Contractor for Contractor
            Services.
            <br />"<strong>Contractor Services</strong>" means services Contractor provide to Customer.
            <br />"<strong>Customer</strong>" means an entity that uses the Services to contract with and pay for
            Contractor Services.
            <br />"<strong>Confidential Information</strong>" means all written or oral information, disclosed by or on
            behalf of either Gumroad or You to the other that has been identified as confidential or that by the nature
            of the information or circumstances surrounding disclosure would be reasonably understood to be confidential
            or proprietary.
            <br />"<strong>Flexile Fees</strong>" means the compensation Customer owes to Gumroad for the Services as
            set forth on this [Pricing Page] and on the Platform, which Gumroad may revise Gumroad from time to time by
            providing notice to Customer on the Platform.
            <br />"<strong>Services</strong>" means the services provided by Gumroad whereby Customer can engage and pay
            Contractor(s) for services.
            <br />"<strong>Users</strong>" means users of the Services and includes both Customer and Contractor.
          </li>
          <li id="jump_2">
            <strong>SERVICES. </strong>The Services act as a platform whereby Customer and Contractor can engage with
            one another for the provision of Contractor Services. Subject to the terms and conditions set forth in this
            Agreement, Gumroad will use commercially reasonable efforts to provide You with access to the Services. If
            You are a Customer, You can submit to Gumroad the Contractor(s) You are seeking to engage, via email at
            [email address] or through the proper functionality on the Gumroad Platform (each, a "
            <strong>Submission</strong>"). Gumroad reserves the right to refuse Submissions at any time. Submissions
            must be expressly accepted by Gumroad. If You are a Contractor, You must also accept and abide by the terms
            and conditions of this Agreement for a Submission naming You by the Customer to be accepted. You must
            provide all equipment and software necessary to connect to the Services.
          </li>
          <li id="jump_3">
            <strong>RESTRICTIONS</strong>. You will not, and will not permit any Permitted User or third party, to
            directly or indirectly (a) use the Services to provide services to third parties or otherwise provide access
            to the Services to third parties; (b) modify any documentation, or create any derivative product thereof;
            (c) assign, sublicense, sell, resell, lease, rent, or otherwise transfer or convey, or pledge as security or
            otherwise encumber Gumroad&rsquo;s rights under this Section; (d) harvest, collect, gather or assemble
            information or data regarding other Users without their consent; or (e) use the Services or any information
            or data received through or in connection with the Services in a manner that (i) may infringe or violate the
            intellectual property or other rights of any individual or entity, including without limitation the rights
            of publicity or privacy; (ii) may violate applicable laws or governmental regulations; (iii) is unlawful,
            threatening, abusive, harassing, misleading, false, defamatory, libelous, deceptive, fraudulent, invasive of
            another&rsquo;s privacy, tortious, obscene, offensive, profane or racially, ethnically, or otherwise
            discriminatory; (iv) constitutes unauthorized or unsolicited advertising, junk or bulk e-mail; (v)
            impersonates any person or entity, including any employee or representative of Gumroad; (vi)interferes with
            or attempts to interfere with the proper functioning of the Services or uses the Services in any way not
            expressly permitted by this Agreement; or (vii) attempts to engage in or engages in, any potentially harmful
            acts that are directed against the Services.
          </li>
          <li id="jump_4">
            <strong>RELATIONSHIP WITH GUMROAD. </strong>Gumroad merely makes the Services available to enable Customer
            and Contractor to transact directly with each other. Through the Services, Customer and Contractor are able
            to enter into an agreement between one another for the provision of, and payment for, Contractor Services.
            Additionally, if Customer opts to use any external or custom legal documents for onboarding or engaging
            Contractors, Customer acknowledges that Gumroad shall not be liable for any claims, liabilities, or damages
            arising from or related to such documents.
          </li>
          <li id="jump_5">
            <strong>ACCOUNTS.</strong>
            <ol>
              <li>
                <strong>Registration. </strong>Use of and access to the Services may require registration of an account
                for the Services ("
                <strong>Account</strong>"). In registering an Account, You agree to (a) provide true, accurate, current
                and complete information (<strong>"Registration Data"</strong>) and (b) maintain and promptly update the
                Registration Data to keep it true, accurate, current and complete. You agree not to provide any false or
                misleading information about Your identity or location or business, and to correct any such information
                that is or becomes false or misleading. You acknowledge and agree that Registration Data may be shared
                with other Users in connection with the Services, and You hereby grant Gumroad a non-exclusive,
                worldwide, royalty free right and license to use, display, perform, transmit, and otherwise exploit Your
                Registration Data in connection with the Services. For further information about Gumroad&rsquo;s
                collection, use and sharing of Your personal information, please refer to Gumroad&rsquo;s Flexile
                Platform privacy statement available at[add link]. You are responsible for all activities that occur
                under Your Account and may not share Account or password information with anyone. You agree to notify
                Gumroad immediately of any unauthorized use of Your password or any other breach of security. If You
                provide any information that is untrue, inaccurate, not current or incomplete, or Gumroad has reasonable
                grounds to suspect that any information You provide is untrue, inaccurate, not current or incomplete,
                Gumroad has the right to suspend or terminate Your Account and refuse any and all current or future use
                of the Services (or any portion thereof). Customers may not have more than one Account at any given
                time. You may not create an Account or use the Services if You have been previously banned from the
                Services. Gumroad reserves the right to decline a registration to join Gumroad or to add an Account
                type, for any lawful reason, including supply and demand, cost to maintain data, or other business
                considerations.
              </li>
              <li>
                <strong>Account Verification. </strong>When You register for an Account and from time to time
                thereafter, Your Account will be subject to verification, including, but not limited to, validation
                against third-party databases or verification of one or more official government or legal documents that
                confirm Your identity, location, and ability to act on behalf of Your business. You authorize Gumroad,
                directly or through third parties, to make any inquiries necessary to validate Your identity, location,
                and ownership of Your email address or financial accounts, subject to applicable law. When requested,
                You must timely provide Gumroad with complete information about You and Your business, which includes,
                but is not limited to, providing official government or legal documents.
              </li>
              <li>
                <strong>Permitted Users. </strong>By granting any individuals or entities permission under Your Account
                (a "<strong>Permitted User</strong>"), You represent and warrant that (a) the Permitted User is
                authorized to act on Your behalf, and (b) You are fully responsible and liable for any action of any
                Permitted User and any other person who uses the Account. If any such Permitted User violates the terms
                of this Agreement, it may affect Your ability to use the Services.
              </li>
            </ol>
          </li>
          <li id="jump_6">
            <strong>OWNERSHIP.</strong>
            <ol>
              <li>
                <strong>Gumroad. </strong>Gumroad and its suppliers own all rights, title and interest in the Services;
                all information and materials provided by or on behalf of Gumroad to You in connection with the Services
                (excluding User Content); and Gumroad&rsquo;s trademarks, and all related graphics, logos, service marks
                and trade names used on or in connection with the Services (collectively, "<strong>Gumroad IP</strong>
                "). Gumroad reserves all rights in Gumroad IP not expressly granted herein.
              </li>
              <li>
                <strong>User Content</strong>. You own all rights, title and interest in, and You hereby grant Gumroad a
                fully paid, royalty-free, worldwide, non-exclusive right and license to use, license, distribute,
                reproduce, modify, adapt, publicly perform, and publicly display, any information, data, text, software,
                and/or other materials provided by or on Your behalf to Gumroad in connection with the Services
                (collectively, <strong>"User Content"</strong>) for the purposes of operating and providing the Services
                to You and other Users. You are solely responsible for Your User Content, including the accuracy
                thereof, and for any legal action that may be instituted by other Users or third parties as a result of
                or in connection with Your User Content.
              </li>
              <li>
                <strong>Feedback. </strong>You hereby grant to Gumroad a fully paid, royalty-free, perpetual,
                irrevocable, worldwide, non-exclusive, and fully sublicensable right and license to use, reproduce,
                perform, display, distribute, adapt, modify, re-format, create derivative works of, and otherwise
                commercially or non-commercially exploit in any manner (a) any and all feedback, suggestions, or ideas
                related to the Services or Gumroad&rsquo;s products, services, or business provided by You
                (collectively, "<strong>Feedback</strong>") and to sublicense the foregoing rights, in connection with
                the operation, maintenance, and improvement of the Services and/or Gumroad&rsquo;s business and (b) any
                feedback, suggestions, ideas, responses, comments, information, and data, including survey responses,
                provided by You or on Your behalf related to any Contractor Services or other Users ("
                <strong>Service Assessments</strong>"), and to sublicense the foregoing rights, in connection with the
                operation, maintenance, and improvement of the Services and/or Gumroad&rsquo;s business, provided that
                Gumroad shall not share any Service Assessments with any third parties in a manner that identifies You
                by name.
              </li>
            </ol>
          </li>
          <li id="jump_7">
            <strong>INVESTIGATIONS. </strong>Although Gumroad does not generally monitor User activity occurring in
            connection with the Services or Contractor Services, if Gumroad becomes aware of any possible violations by
            any Users of any terms between Gumroad and its Users, Gumroad reserves the right, but has no obligation, to
            investigate such violations. If, as a result of the investigation, Gumroad believes that criminal activity
            has occurred, Gumroad reserves the right to refer the matter to, and to cooperate with, any and all
            applicable legal authorities. Gumroad is entitled, except to the extent prohibited by applicable law, to
            disclose any information or materials on or in connection with the Services, including User Content or
            Registration Data, in Gumroad&rsquo;s possession in connection with Your use of the Services, to (i) comply
            with applicable laws, legal process or governmental request; (ii) enforce the Agreement; (iii)respond to any
            claims that Your content, acts, or omissions violates the rights of third parties; (iv) respond to requests
            for customer service; or (v) protect the rights, property or personal safety of Gumroad, its Users or the
            public, and all enforcement or other government officials, as Gumroad in its sole discretion believes to be
            necessary or appropriate.
          </li>
          <li id="jump_8">
            <strong>INTERACTIONS WITH OTHER USERS. </strong>You are solely responsible for Your interactions with other
            Users and any other parties with whom You interact; provided, however, that Gumroad reserves the right, but
            has no obligation, to intercede in such disputes. You agree that Gumroad will not be responsible for any
            liability incurred as the result of such interactions. While Gumroad may, in Gumroad&rsquo;s sole
            discretion, help facilitate the resolution of disputes through various programs, Gumroad has no control over
            and does not guarantee the existence, quality, safety or legality of Contractor Services; Customer&rsquo;s
            ability to procure services; Contractor&rsquo;s ability to provide Contractor Services; or that a Customer
            and Contractor will actually complete a transaction.
          </li>
          <li id="jump_9">
            <strong>FEES.</strong>
            <ol>
              <li>
                <strong>IC AGREEMENTS; FEES. </strong>Customer and its Contractor(s) must enter into an IC Agreement for
                Contractor Services. When You enter into an IC Agreement, You agree to use the Services: (a) if you are
                a Customer, to pay any Flexile Fees You owe under this Agreement and any Contractor Fees You owe under
                the IC Agreement; and (b) if you are a Contractor, to receive any Contractor Fees you are owed under the
                IC Agreement. All Contractor Fees must be paid and received through the Services in accordance with the
                terms of this Agreement and the IC Agreement.
              </li>
              <li>
                <strong>Payment</strong>. Customer is responsible for making all Flexile Fees, or Contractor Fees, as
                applicable, in the amounts and on the schedule agreed to (a) via the Dashboard or such other method
                specified by Flexile (with respect to the Flexile Fees), and (b) with Contractor in the IC Agreement
                (with respect to the Contractor Fees), and as set forth herein. Gumroad will remit to Contractor the
                Contractor Fees within thirty (30) days of actually receiving payment from Customer. Gumroad shall not
                be responsible for payment of any amounts not actually received by Gumroad, or for any chargebacks,
                deductions, errors, or other payment disputes or issues, provided that Gumroad reserves the right to
                offset or deduct amounts owed to Gumroad, or for chargebacks, deductions, errors, or other payment
                issues, from amounts received by Gumroad hereunder.
              </li>
              <li>
                <strong>Expenses. </strong>Gumroad shall not be responsible for any expenses incurred by You in
                connection with any Contractor Services. If Customer agrees to reimburse Contractor for expenses
                incurred ("
                <strong>
                  <em>Expenses</em>
                </strong>
                "), such reimbursement will be handled directly between Customer and Contractor in accordance with the
                terms set forth in the applicable IC Agreement; provided that Expenses shall only include amounts
                actually paid by Contractor to third parties for products and services required for Contractor&rsquo;s
                provision of the Contractor Services. All other amounts paid to Contractor shall be considered
                Contractor Fees and must be paid through the Services. Gumroad reserves the right to require You to
                provide receipts and other documentation for any Expenses.
              </li>
              <li>
                <strong>No Refunds; Non-Payment. </strong>All Fees and other amounts paid hereunder are nonrefundable.
                Furthermore, Gumroad reserves the right to seek reimbursement from You, and You will reimburse Gumroad,
                if Gumroad (a) suspects fraud or criminal activity associated with any payment; (b) discovers erroneous
                or duplicate transactions; or (c) receives any chargebacks from a payment method.
              </li>
              <li>
                <strong>Withholding Taxes. </strong>The amounts paid under this Agreement do not include any taxes or
                withholdings ("<strong>Taxes</strong>") that may be due in connection with any Services provided under
                this Agreement. If Gumroad determines it has a legal obligation to collect Tax from You in connection
                with this Agreement, Gumroad shall collect such Tax in addition to the amounts required under this
                Agreement. If any Services, or payments for any Services, under the Agreement are subject to Tax in any
                jurisdiction and You have not remitted the applicable Tax to Gumroad, You will be responsible for the
                payment of such Tax and any related penalties or interest to the relevant tax authority and will
                indemnify Gumroad Parties for any liability or expense incurred. Upon Gumroad&rsquo;s request, You will
                provide official receipts issued by the appropriate taxing authority, or such other evidence or
                documents reasonably requested.
              </li>
              <li>
                <strong>Other Taxes. </strong>You (Contractor)acknowledge and agree that You are solely responsible (a)
                for all tax liability associated with payments received from Customer and through Gumroad, and that
                Gumroad will not withhold any taxes from payments to You; (b) to obtain any liability, health,
                workers&rsquo; compensation, disability, unemployment, or other insurance needed, desired, or required
                by law, and that You are not covered by or eligible for any insurance from Gumroad; (c) for determining
                whether You are required by applicable law to issue any particular invoices for the Contractor Fees and
                for issuing any invoices so required; (d) for filing all tax returns and submitting all payments as
                required by any federal, state, local, or foreign tax authority arising from the payment of Contractor
                Fees to You, and You agree to do so in a timely manner; and (e) if outside of the United States, for
                determining if Gumroad is required by applicable law to withhold any amount of the Contractor Fees and
                for notifying Gumroad of any such requirement and indemnifying Gumroad for any requirement to pay any
                withholding amount to the appropriate authorities (including penalties and interest). Gumroad may report
                the Contractor Fees paid to Contractor by filing Form 1099-MISC with the Internal Revenue Service as
                required by law. In the event of an audit of Gumroad, You agree to promptly cooperate with Gumroad and
                provide copies of Your tax returns and other documents as may be reasonably requested for purposes of
                such audit, including but not limited to records showing You are engaging in an independent business as
                represented to Gumroad. You further acknowledge, agree, and understand that: (i) You are not an employee
                of Gumroad and are not eligible for any of the rights or benefits of employment (including unemployment
                and/or workers compensation insurance).
              </li>
              <li>
                <strong>Records. </strong>You will create and maintain records to document satisfaction of obligations
                under this Agreement and provide copies of such records to Gumroad upon request.
              </li>
            </ol>
          </li>
          <li id="jump_10">
            <strong>CONFIDENTIAL INFORMATION.</strong>
            <ol>
              <li>
                <strong>Between Gumroad and You</strong>. Gumroad and You each agree as follows: (a) to use Confidential
                Information disclosed by the other party only for the purposes expressly permitted herein; (b) that such
                party will not reproduce Confidential Information disclosed by the other party, and will hold in
                confidence and protect such Confidential Information from dissemination to, and use by, any third party;
                (c) that neither party will create any derivative work from Confidential Information disclosed to such
                party by the other party; (d) to restrict access to the Confidential Information disclosed by the other
                party to such of its personnel, agents, and/or consultants, who have a need to have access and who have
                been advised of, and have agreed in writing to treat such information in accordance with, the terms of
                this Agreement; and (e) to the extent practicable, return or destroy all Confidential Information
                disclosed by the other party that is in its possession upon termination or expiration of this Agreement.
                Both parties agree that all items of Confidential Information are proprietary to the disclosing party,
                and as between the parties, will remain the sole property of the disclosing party.
              </li>
              <li>
                <strong>Confidentiality Exceptions. </strong>Notwithstanding the foregoing, the provisions of Section
                10.1 will not apply to Confidential Information that (a) is publicly available or in the public domain
                at the time disclosed; (b) is or becomes publicly available or enters the public domain through no fault
                of the recipient; (c) is rightfully communicated to the recipient by persons not bound by
                confidentiality obligations with respect thereto; (d) is already rightfully in the recipient&rsquo;s
                possession free of any confidentiality obligations with respect thereto at the time of disclosure; (e)
                is independently developed by the recipient without use of or reference to the other party&rsquo;s
                Confidential Information; or (f) is approved for release or disclosure by the Disclosing party without
                restriction. Notwithstanding the foregoing, each party may disclose Confidential Information to the
                limited extent required (i) to comply with the order of a court or other governmental body, or as
                otherwise necessary to comply with applicable law, provided that the party making the disclosure
                pursuant to the order shall first have given written notice to the other party (to the extent legally
                permitted) and made a reasonable effort to obtain a protective order; or (ii) to establish a
                party&rsquo;s rights under this Agreement, including to make such court filings as it may be required to
                do.
              </li>
            </ol>
          </li>
          <li id="jump_11">
            <strong>NO SOLICITATION. </strong>You may not use the Services to solicit for any other business, website or
            services. You may not solicit, advertise for, or contact Contractors for employment, contracting, or any
            other purpose not related to the Services.
          </li>
          <li id="jump_12">
            <strong>NON-CIRCUMVENTION.</strong>
            <ol>
              <li>
                <strong>Non-Circumvention</strong>. You acknowledge and agree that a substantial portion of the
                compensation Gumroad receives for providing the Services is collected through the Service Fee described
                in this Agreement. Gumroad only receives this Service Fee when a Customer and a Contractor pay and
                receive payment through the Services. Therefore, during the term of this Agreement, You agree to use the
                Services as Your exclusive method to make, or receive, as applicable, all payments for work directly or
                indirectly between You and a Contractor (if You are a Customer), or You and a Customer (if You are a
                Contractor).
              </li>
              <li>
                <strong>Restrictions. </strong>You agree not to circumvent the payment process managed by Gumroad in
                connection with the Services. Without limiting the generality of the foregoing, You agree not to: (a) as
                applicable, invoice or receive payment for Contractor Services outside the Services; or (b) invoice or
                report on the Services a payment amount lower than that actually agreed (including with respect to
                allocations between Contractor Fees and Expenses). You shall notify Gumroad immediately upon becoming
                aware of a breach or potential breach of this non-circumvention provision.
              </li>
            </ol>
          </li>
          <li id="jump_13">
            <strong>INDEMNIFICATION</strong>
            <strong>. </strong>You agree to defend, indemnify and hold Gumroad, its parents, subsidiaries, affiliates,
            officers, employees, agents, partners, suppliers, and licensors (each, a<strong>"Gumroad Party"</strong> and
            collectively, the <strong>"Gumroad Parties"</strong>) harmless from any losses, costs, liabilities and
            expenses (including reasonable attorneys&rsquo; fees) relating to or arising out of any and all of the
            following: (a) User Content; (b)Your use of the Services; (c) Your violation of the Agreement or of any
            rights of another party, including any other Users; or (d)Your violation of any applicable laws, rules or
            regulations. Gumroad reserves the right, at its own cost, to assume the exclusive defense and control of any
            matter otherwise subject to indemnification by You, in which event You will fully cooperate with Gumroad in
            asserting any available defenses. For purposes of this Section 13, You includes any of Your agents or any
            person who has apparent authority to access or use Your Account.
          </li>
          <li id="jump_14">
            <strong>DISCLAIMER OF WARRANTIES.</strong>
            <ol>
              <li>
                <strong>As Is. </strong>YOUR USE OF THE SERVICES AND PARTICIPATION IN ANY TRANSACTIONS OR ARRANGEMENTS
                MADE IN CONNECTION THEREWITH ARE AT YOUR SOLE RISK. THE SERVICES ARE PROVIDED ON AN "
                <strong>AS IS</strong>" AND "<strong>AS AVAILABLE</strong>" BASIS, WITH ALL FAULTS. GUMROAD PARTIES
                EXPRESSLY DISCLAIM ALL WARRANTIES, REPRESENTATIONS, AND CONDITIONS OF ANY KIND, WHETHER EXPRESS OR
                IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OR CONDITIONS OF MERCHANTABILITY, FITNESS
                FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. THE GUMROAD PARTIES MAKE NO WARRANTY, REPRESENTATION OR
                CONDITION THAT THE SERVICES OR ANY SERVICES OBTAINED OR TRANSACTIONS MADE IN CONNECTION THEREWITH WILL
                MEET YOUR REQUIREMENTS.
              </li>
              <li>
                <strong>Third Parties or Other Users. </strong>YOU ACKNOWLEDGE AND AGREE THAT GUMROAD PARTIES ARE NOT
                LIABLE, AND YOU AGREE NOT TO SEEK TO HOLD GUMROAD PARTIES LIABLE, FOR THE CONDUCT OF THIRD PARTIES, AND
                THAT THE RISK OF INJURY FROM SUCH THIRD PARTIES RESTS ENTIRELY WITH YOU. YOU ARE SOLELY RESPONSIBLE FOR
                ALL OF YOUR COMMUNICATIONS AND INTERACTIONS WITH OTHER USERS OF THE SERVICES.
              </li>
              <li>
                <strong>Compliance with Laws. </strong>YOU ACKNOWLEDGE AND AGREE THAT YOU ARE SOLEY RESPONSIBLE FOR YOUR
                COMPLIANCE WITH APPLICABLE LAWS, INCLUDING APPLICABLE PRIVACY AND DATA PROTECTION LAWS, IN YOUR USE OF
                THE SERVICES AND IN ANY TRANSACTIONS OR ARRANGEMENTS MADE BY YOU IN CONNECTION THEREWITH. WITHOUT
                LIMITATION TO THE FOREGOING, YOU (CUSTOMER) ARE SOLEY RESPONSIBLE FOR SATISFYING ANY OBLIGATIONS TO
                WHICH YOU MAY BE SUBJECT UNDER APPLICABLE LAWS TO (A) PROVIDE PRIVACY OR OTHER TRANSPARENCY NOTICES TO
                CONTRACTORS; AND (B) TO ENTER INTO ANY DATA PROCESSING OR OTHER SIMILAR AGREEMENTS IN RESPECT OF
                CONTRACTORS&rsquo; PROCESSING OF PERSONAL DATA ON YOUR BEHALF.
              </li>
            </ol>
          </li>
          <li id="jump_15">
            <strong>LIMITATION OF LIABILITY. </strong>TO THE FULLEST EXTENT PROVIDED BY LAW, IN NO EVENT SHALL GUMROAD
            PARTIES BE LIABLE TO YOU UNDER THIS AGREEMENT AND THE ENGAGEMENT AGREEMENT, COLLECTIVELY, FOR (a) ANY
            INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, OR DAMAGES OR COSTS DUE TO LOSS OF PRODUCTION OR
            USE, BUSINESS INTERRUPTION, OR PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES, IN EACH CASE WHETHER OR NOT
            GUMROAD HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES, ARISING OUT OF OR IN CONNECTION WITH THESE
            TERMS OF SERVICE OR ANY COMMUNICATIONS, INTERACTIONS OR MEETINGS WITH OTHER USERS, ON ANY THEORY OF
            LIABILITY, OR (b) ANY AMOUNTS THAT ARE GREATER THAN THE TOTAL AMOUNT PAID TO GUMROAD BY CUSTOMER DURING THE
            TWELVE-MONTH PERIOD PRIOR TO THE ACT, OMISSION OR OCCURRENCE GIVING RISE TO SUCH LIABILITY. THE LIMITATIONS
            OF DAMAGES SET FORTH ABOVE ARE FUNDAMENTAL ELEMENTS OF THE BASIS OF THE BARGAIN BETWEEN GUMROAD AND YOU.
          </li>
          <li id="jump_16">
            <strong>TERM AND TERMINATION.</strong>
            <ol>
              <li>
                <strong>Term. </strong>The Agreement commences on the Effective Date and remain in full force and effect
                until terminated by either party in accordance with this Agreement.
              </li>
              <li>
                <strong>Termination for Breach. </strong>Either party may terminate this Agreement upon written notice
                to the other party if the other party breaches this Agreement and does not cure such breach within
                fifteen (15) days of receiving notice thereof. Furthermore, without limiting Gumroad&rsquo;s other
                rights or remedies, Gumroad may, but is not obligated to, temporarily or indefinitely revoke access to
                the Services,
              </li>
              <li>
                <strong>Termination for Convenience. </strong>Gumroad may terminate this Agreement for its convenience
                at any time for any reason or no reason at all by providing You with at least thirty (30) days prior
                written notice.
              </li>
              <li>
                <strong>Effect of Termination. </strong>Termination of this Agreement does not terminate or otherwise
                impact any IC Agreement entered into between Customer and Contractor. If this Agreement is terminated
                while one or more open IC Agreements are in effect, You agree (a) You will continue to be bound by this
                Agreement until all such IC Agreements are closed or end (in accordance with their terms); (b) Gumroad
                will continue to perform the Services necessary to complete any open transaction between Customer and
                Contractor(s); and (c) Customer will continue to be obligated to pay any amounts owed under the
                Agreement. Any provisions that by their nature would be expected to survive any termination or
                expiration of this Agreement will survive such termination or expiration.
              </li>
              <li>
                <strong>Notification. </strong>If Gumroad decides to temporarily or permanently close Your Account,
                Gumroad has the right where allowed by law but not the obligation to: (a) notify other Users that have
                entered into IC Agreements with You to inform them of Your closed account status, and (b) provide those
                Users with a summary of the reasons for Your account closure. You agree that Gumroad will have no
                liability arising from or relating to any notice that it may provide to any User regarding closed
                account status or the reason(s) for the closure<strong>.</strong>
              </li>
            </ol>
          </li>
          <li id="jump_17">
            <strong>RELEASE</strong>. Gumroad expressly disclaims any liability that may arise between Users. Because
            Gumroad is not a party to the actual contracts between Customers and Contractors, in the event that You have
            a dispute with one or more Users, You release Gumroad, its parents, subsidiaries, affiliates, officers,
            employees, investors, agents, partners and licensors, but excluding any Users (collectively, the "
            <strong>Gumroad Parties</strong>") from any and all claims, demands, or damages (actual or consequential) of
            every kind and nature, known and unknown, suspected and unsuspected, disclosed and undisclosed, arising out
            of or in any way connected with such disputes. You hereby waive California Civil Code Section 1542, or any
            similar law of any other jurisdiction which states in substance, "A general release does not extend to
            claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the
            time of executing the release and that, if known by him or her, would have materially affected his or her
            settlement with the debtor or released party."
          </li>
          <li id="jump_18">
            <strong>DISPUTE RESOLUTION. </strong>All claims and disputes arising out of or relating to the Agreement
            will be litigated exclusively in the state or federal courts located in San Francisco, CA. This Agreement
            and any action related thereto will be governed and interpreted by and under the laws of the State of
            California, consistent with the Federal Arbitration Act, without giving effect to any principles that
            provide for the application of the law of another jurisdiction. The United Nations Convention on Contracts
            for the International Sale of Goods does not apply to the Agreement.
          </li>
          <li id="jump_19">
            <strong>CONSTRUCTION. </strong>Section headings are included in this Agreement merely for convenience of
            reference; they are not to be considered part of this Agreement or used in the interpretation of this
            Agreement. When used in this Agreement, "including" means "including without limitation." No rule of strict
            construction will be applied in the interpretation or construction of this Agreement.
          </li>
          <li id="jump_20">
            <strong>GENERAL PROVISIONS. </strong>The Agreement, and Your rights and obligations hereunder, may not be
            assigned, subcontracted, delegated or otherwise transferred by You without Gumroad&rsquo;s prior written
            consent, and any attempted assignment, subcontract, delegation, or transfer in violation of the foregoing
            will be null and void. Nothing in this Agreement is intended to or should be construed to create a
            partnership, joint venture, franchisor/franchisee or employer-employee relationship between Gumroad and You.
            Gumroad shall not be liable for any delay or failure to perform resulting from causes outside its reasonable
            control, including, but not limited to, acts of God, war, natural disasters, disease, terrorism, riots,
            embargos, acts of civil or military authorities, fire, floods, accidents, strikes or shortages of
            transportation facilities, fuel, energy, labor or materials. You may give notice to Gumroad at the following
            address: hi@gumroad.com. Such notice shall be deemed given when received by Gumroad by letter delivered by
            nationally recognized overnight delivery service or first class postage prepaid mail at the above address.
            Any waiver or failure to enforce any provision of the Agreement on one occasion will not be deemed a waiver
            of any other provision or of such provision on any other occasion. If any portion of this Agreement is held
            invalid or unenforceable, that portion shall be construed in a manner to reflect, as nearly as possible, the
            original intention of the parties, and the remaining portions shall remain in full force and effect. The
            Agreement is the final, complete and exclusive agreement of the parties with respect to the subject matter
            hereof and supersedes and merges all prior discussions between the parties with respect to such subject
            matter.
          </li>
        </ol>
      </section>
    </SimpleLayout>
  );
}
