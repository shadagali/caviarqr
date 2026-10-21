import {
  createHash,
} from 'crypto'

export const
  SALES_PARTNER_AGREEMENT_VERSION =
    '2026-09-15-v2'

export const
  SALES_PARTNER_AGREEMENT_TITLE =
    'Independent Sales Partner Agreement'

export const
  SALES_PARTNER_AGREEMENT_EFFECTIVE_DATE =
    '2026-09-15'

const SALES_PARTNER_AGREEMENT_TEXT = `
INDEPENDENT SALES PARTNER AGREEMENT

Effective Date: September 15, 2026

This Independent Sales Partner Agreement ("Agreement") is between CaviarQR, Inc. ("CaviarQR") and the individual or entity accepting this Agreement ("Partner").

1. INDEPENDENT BUSINESS RELATIONSHIP

Partner performs authorized sales and referral activities as an independent business and not as an employee, agent, joint venturer, franchisee, or legal representative of CaviarQR, except where applicable law requires a different classification.

Partner controls when, where, and how Partner performs authorized sales and referral activities, subject to this Agreement, applicable law, truthful product representations, and CaviarQR brand and compliance requirements.

Partner is not required to work fixed hours, work exclusively for CaviarQR, or perform services from a particular location.

Partner has no authority to sign contracts on behalf of CaviarQR, bind CaviarQR, alter CaviarQR pricing, promise unapproved features, guarantee results, waive fees, issue refunds, or make commitments for CaviarQR unless CaviarQR expressly authorizes the action in writing.

Nothing in this Agreement waives any right that cannot legally be waived or overrides any worker classification required by applicable law.

2. SALES AND REFERRAL SERVICES

Partner may introduce prospective restaurants, cafes, merchants, and other eligible businesses to CaviarQR.

Partner must accurately describe CaviarQR and may use only current pricing, product information, promotional materials, and representations authorized by CaviarQR.

Partner may choose Partner's own lawful prospecting methods and sales process.

Partner must not use deceptive, misleading, harassing, fraudulent, or unlawful sales practices.

Partner must comply with applicable advertising, telephone, email, text-message, privacy, anti-spam, anti-bribery, and consumer-protection laws.

3. REFERRAL CODE AND ATTRIBUTION

CaviarQR may issue Partner a referral code or another attribution identifier.

A referral code is assigned to a specific Partner account and may not be sold, transferred, manipulated, or used to create fraudulent or self-referrals.

CaviarQR may attribute a restaurant to Partner through referral-code usage, hardware purchases, stand allocation, store activation, verified account records, or other CaviarQR attribution systems.

Once attribution becomes locked under CaviarQR's systems, it remains assigned to that Partner unless CaviarQR makes a documented correction for demonstrated technical error, fraud, duplicate attribution, or another authorized administrative reason.

CaviarQR's system records control attribution, subject to those documented corrections.

4. COMMISSION

Unless CaviarQR and Partner agree otherwise in writing, Partner's standard commission rate is ten percent (10%) of eligible CaviarQR platform fees actually collected and retained by CaviarQR from restaurant transactions attributed to Partner.

Commission is calculated from CaviarQR's platform fee, not from restaurant gross sales, customer order value, payment-processor revenue, taxes, tips, shipping, hardware revenue, or restaurant profit.

For example, if an attributed restaurant processes $1,000 in eligible restaurant orders and CaviarQR collects and retains $47.50 in platform fees, a 10% commission rate produces a $4.75 Partner commission.

The commission rate stored on Partner's CaviarQR account is the controlling rate for system calculations.

While Partner's account is Active and this Agreement remains in effect, eligible transactions from restaurants attributed to Partner may continue generating commission according to Partner's applicable commission rate. Commission is ongoing by default unless future commission eligibility for an attributed restaurant or the Partner relationship is terminated prospectively.

CaviarQR may terminate future commission eligibility for a specific attributed restaurant prospectively. Commission legitimately earned from eligible transactions before the effective termination time remains subject to the normal availability, adjustment, fraud-review, and payout provisions and is not erased by that termination.

Unless CaviarQR records a different cap for Partner, Partner's default maximum commission accrual is $20,000 USD per UTC calendar month across all attributed restaurants. CaviarQR may record a different monthly cap for Partner prospectively. If an otherwise eligible transaction would exceed the applicable monthly cap, only the portion up to the remaining cap may be earned, and additional commission does not accrue until the next UTC calendar month unless the cap is increased. A cap change does not retroactively reduce commission already earned.

CaviarQR may change a Partner's commission rate prospectively by providing notice or obtaining written agreement where required. A prospective rate change will not retroactively reduce commission already earned before the change takes effect.

No commission is earned on amounts CaviarQR does not actually collect and retain, including amounts that are reversed, returned, credited, written off, or determined to result from fraud, abuse, duplicate attribution, or material technical or accounting error.

CaviarQR may make documented corrections or reversals to commission records when reasonably necessary to correct those situations.

5. COMMISSION AVAILABILITY

A commission is initially recorded as pending.

Unless CaviarQR communicates a different written commission plan applicable to Partner, an otherwise eligible commission becomes available for payout thirty (30) calendar days after the underlying restaurant transaction is successfully paid.

During that period, CaviarQR may review the transaction for settlement failure, fraud, disputes, reversals, attribution error, payment risk, or other legitimate accounting or compliance concerns.

A commission does not become available while CaviarQR reasonably determines that the related transaction or platform fee requires investigation.

If the underlying CaviarQR platform fee is reversed, refunded, credited, or otherwise not retained by CaviarQR, the related commission may be reversed or corrected.

6. PAYOUT SCHEDULE

CaviarQR normally processes Sales Partner payouts once per calendar month.

Each monthly payout may include eligible commissions that became available through the end of the preceding calendar month.

Processing dates may vary because of weekends, banking schedules, payment-provider requirements, compliance review, technical issues, or other reasonable operational circumstances.

A commission becoming "available" does not mean that funds will arrive in Partner's bank account immediately.

Partner must maintain a valid, verified, payout-ready account and provide information reasonably required for lawful payment and tax reporting.

CaviarQR currently supports Sales Partner payouts in United States dollars through eligible United States payout accounts.

CaviarQR may use Stripe or another regulated payment provider to deliver Partner payouts.

CaviarQR is not responsible for delays caused by incomplete Partner verification, incorrect information supplied by Partner, payment-provider review, banking-network delays, government restrictions, or circumstances outside CaviarQR's reasonable control.

7. EXACT COMMISSION ACCOUNTING

CaviarQR may calculate commission using exact internal accounting units smaller than one cent.

CaviarQR does not round Partner commission upward or downward on an order-by-order basis.

When payment systems require payouts to be denominated in whole cents, CaviarQR pays only the whole-cent portion currently payable.

Any valid fractional-cent remainder remains recorded for Partner and carries forward toward a later payout.

8. STRIPE CONNECT

CaviarQR may require Partner to create or connect a Stripe Express account or another supported payout account.

Partner is responsible for completing the payment provider's identity, banking, tax, and verification requirements.

Stripe and other payout providers are independent third parties and their services are governed by their own terms and policies.

CaviarQR does not control whether a payout provider approves, restricts, pauses, or closes an account.

Payment-provider payout readiness does not automatically make Partner an approved or Active CaviarQR Sales Partner.

9. TAXES

Partner is responsible for Partner's own federal, state, local, and other taxes arising from compensation paid under this Agreement, except to the extent applicable law imposes a different obligation on CaviarQR.

Partner must provide accurate tax information reasonably requested by CaviarQR or its payment provider.

CaviarQR may issue Forms 1099 or other tax forms when required by law and may apply legally required withholding.

Nothing in this Agreement constitutes tax advice.

10. EXPENSES

Unless CaviarQR agrees otherwise in writing, Partner is responsible for Partner's own lawful business expenses, equipment, communications, transportation, workspace, and other costs incurred while performing referral or sales activities.

11. CUSTOMER AND BUSINESS INFORMATION

Partner may use prospect and merchant information only for legitimate CaviarQR sales activities and in compliance with applicable privacy and communications laws.

Partner must not collect customer payment-card numbers, banking credentials, passwords, Stripe credentials, CaviarQR administrative credentials, or other sensitive authentication information.

Partner must protect confidential CaviarQR information and non-public merchant information and must not disclose or misuse it.

12. CAVIARQR BRAND AND INTELLECTUAL PROPERTY

CaviarQR grants Partner a limited, revocable, non-exclusive, non-transferable right to use approved CaviarQR names, marks, sales materials, and product information solely for authorized activities under this Agreement.

Partner receives no ownership interest in CaviarQR intellectual property.

Partner must stop using CaviarQR branding when this Agreement or Partner's authorization ends.

13. PROHIBITED CONDUCT

Partner must not create fake restaurants, fake orders, fake hardware purchases, fabricated leads, duplicate accounts, manipulated attribution, unauthorized discounts, false statements, misleading advertisements, or other activity intended to generate commission that was not legitimately earned.

CaviarQR may investigate suspected fraud, security issues, legal violations, or abuse and may pause affected accounts, commissions, or payouts while investigating.

14. NO GUARANTEED COMPENSATION

Partner understands that compensation is commission-based unless CaviarQR separately agrees otherwise in writing.

CaviarQR does not guarantee Partner any minimum number of leads, restaurants, transactions, commissions, hours, income, territory, or level of business.

15. ACCOUNT STATUS

CaviarQR may use statuses including Pending, Active, Paused, or Disabled for Partner accounts.

Only an Active Partner account is eligible to generate new commission unless CaviarQR expressly provides otherwise in writing.

CaviarQR may pause or disable access for suspected fraud, security risk, material breach, legal or regulatory risk, noncompliance, or misuse of CaviarQR systems.

16. RECORDS AND COMMISSION QUESTIONS

Partner agrees that CaviarQR may maintain electronic records relating to this Agreement, referral attribution, commissions, payouts, account activity, agreement acceptance, acceptance time, browser information, and network information for legitimate business, security, compliance, tax, and evidentiary purposes.

Partner should notify CaviarQR promptly if Partner believes an attribution, commission, or payout record contains an error.

CaviarQR may investigate and correct demonstrated technical or accounting errors.

17. ELECTRONIC ACCEPTANCE

By checking the acceptance box and submitting the Sales Partner registration form, Partner electronically accepts the version of this Agreement displayed at the time of acceptance.

CaviarQR may store the Agreement version, cryptographic hash, acceptance timestamp, IP address, and user-agent information as evidence of acceptance.

18. CHANGES TO THE AGREEMENT

CaviarQR may issue a new version of this Agreement or an incorporated commission or payout policy.

When CaviarQR requires acceptance of a new version, Partner may be required to review and accept it before continuing specified activities.

A new agreement version does not alter historical acceptance records for prior versions.

19. TERMINATION

Either party may end the Sales Partner relationship subject to applicable law.

Commission legitimately earned from eligible transactions occurring before the effective time of termination remains subject to the availability, adjustment, fraud-review, and payout provisions of this Agreement.

Unless CaviarQR agrees otherwise in writing, restaurant transactions occurring after the effective time of termination do not generate new Partner commission.

Termination does not permit either party to erase legitimate historical transaction, attribution, commission, payout, tax, security, or agreement records that CaviarQR is entitled or required to retain.

20. COMPLIANCE WITH LAW

Each party remains responsible for complying with laws applicable to that party.

If any provision of this Agreement conflicts with a non-waivable legal requirement, that legal requirement controls to the minimum extent necessary.

21. ENTIRE AGREEMENT

This Agreement, together with any written commission plan, payout policy, or other terms expressly incorporated into it, represents the agreement concerning the Sales Partner relationship and supersedes prior inconsistent discussions concerning that relationship.

22. GOVERNING LAW

Unless applicable law requires otherwise, this Agreement is governed by the laws of the State of California, without regard to conflict-of-law principles.

END OF AGREEMENT
`.trim()

export function
currentSalesPartnerAgreement() {
  const text =
    SALES_PARTNER_AGREEMENT_TEXT

  const agreementHash =
    createHash('sha256')
      .update(
        text,
        'utf8',
      )
      .digest('hex')

  return {
    title:
      SALES_PARTNER_AGREEMENT_TITLE,

    agreementVersion:
      SALES_PARTNER_AGREEMENT_VERSION,

    effectiveDate:
      SALES_PARTNER_AGREEMENT_EFFECTIVE_DATE,

    agreementHash,

    text,
  }
}
