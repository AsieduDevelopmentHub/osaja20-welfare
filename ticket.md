# OSAJA'20 — Complete E-Ticketing, Ticket Management & Event Verification System

## Project Objective

Build a complete, production-ready event ticketing and admission management system within the existing OSAJA'20 web platform.

OSAJA'20 already has:
- An existing public-facing website and landing page.
- An existing administrative section for managing users.
- An existing Supabase integration and database.
- An established application architecture, design system, authentication mechanism and deployment workflow.

The objective is to extend the existing application rather than build a separate platform.

**IMPORTANT:** Before making any changes, thoroughly inspect the repository, understand the current architecture, identify existing reusable components, inspect the Supabase schema and authentication implementation, and understand the project's coding conventions.

Do not assume technologies, directory locations, database structures, or integrations without inspecting the actual project. Make architectural decisions based on the existing implementation and document important decisions.

Do not unnecessarily replace working systems or introduce redundant dependencies.

---

# 1. EVENT INFORMATION

Event: Bra Fie Night 2027  
Organizer: Old Students of Asuofua D/A JHS "A" (OSAJA'20)  
Event date: Friday, 1 January 2027.

Ticket categories:

| Ticket | Price |
|---|---:|
| Early Bird | GH₵90 |
| Single | GH₵100 |
| Double | GH₵180 |

The system should support configurable ticket categories, prices, quantities, sales periods and availability rather than hardcoding these values throughout the application.

The event administrators should be able to modify ticket settings without requiring code changes.

# 2. PUBLIC TICKET PURCHASING SYSTEM

Integrate ticket purchasing into the existing OSAJA'20 landing page.

Requirements:

- Create a professional ticket purchasing experience consistent with the existing website design.
- Display available ticket categories and prices.
- Allow users to select ticket categories and quantities.
- Collect the necessary purchaser information.
- Collect attendee information where appropriate.
- Calculate totals automatically.
- Display a clear order summary before payment.
- Integrate with the existing or most appropriate supported payment infrastructure.
- Verify payments through secure server-side mechanisms and payment provider webhooks.
- Never issue valid tickets based solely on frontend payment confirmation.
- Prevent duplicate payment processing and duplicate ticket issuance.
- Handle pending, successful, failed, cancelled and refunded transactions.
- Provide customers with clear payment feedback.

After successful payment:

1. Generate the appropriate admission entitlements.
2. Generate unique ticket identifiers.
3. Generate secure QR codes.
4. Store ticket and transaction records.
5. Deliver tickets through the available notification channels.
6. Allow customers to retrieve their tickets again when necessary.

The ticket delivery experience should support downloadable or printable tickets and mobile-friendly digital tickets.

# 3. CRITICAL: DOUBLE TICKET ADMISSION LOGIC

This is a particularly important business requirement. Implement it carefully.

A Double ticket costs GH₵180 and grants admission to TWO people.

However, the two attendees do not necessarily have to arrive together.

The system must support three admission scenarios:

### Scenario A: Both attendees arrive together

- Staff scans the Double ticket QR code.
- The scanner identifies it as a Double ticket with two available admissions.
- Staff can select the option to admit both attendees.
- Both admissions are consumed.
- The ticket becomes fully checked in.
- Subsequent scans must be rejected.

### Scenario B: Only one attendee arrives

- Staff scans the Double ticket QR code.
- The scanner displays that the ticket has two available admissions.
- Staff selects or manually enters the number of people currently arriving.
- Staff selects 1.
- The system admits one person.
- The ticket remains partially used, with one admission remaining.
- The same QR code remains usable.
- When the partner arrives later, staff scans the SAME QR code again.
- The system recognizes the previous partial admission and allows the remaining admission to be used.
- After the second admission, the ticket becomes fully checked in.

### Scenario C: Manual admission quantity

Provide an appropriate input or selection control that allows authorized staff to specify how many people are arriving at that moment.

The maximum selectable number must never exceed the remaining admission quantity.

For a Double ticket:

- Initial entitlement: 2.
- Admit 1: Remaining 1.
- Admit 1 later: Remaining 0.
- Alternatively, admit 2 together: Remaining 0.

### Important implementation rules

- A Double ticket must not generate two unrelated QR codes if the chosen ticket model supports a shared reusable ticket.
- The same QR code must represent the complete two-person admission entitlement.
- Maintain an accurate admission count.
- Track each admission separately.
- Store the timestamp, gate, device and staff member responsible for each admission.
- Prevent concurrent scans from consuming the same remaining admission.
- Use database transactions, atomic operations, row locking or another appropriate concurrency-safe mechanism.
- Reject any admission quantity greater than the remaining entitlement.
- Fully consumed tickets must never be admitted again.
- Preserve the history of partial admissions.
- Make the remaining admission quantity visible to the scanner and administration dashboard.

The system must also support future ticket categories with configurable admission quantities.

# 4. TICKET MANAGEMENT — ADMIN DASHBOARD

Extend the existing administrative dashboard.

Do not build a separate administration application.

Create an integrated ticket management section with the following capabilities.

### Event management

- Create and manage events.
- Configure event details.
- Configure event dates and venues.
- Configure ticket sales periods.
- Enable or disable ticket sales.
- Configure event admission settings.

### Ticket category management

- Create ticket categories.
- Edit ticket names and descriptions.
- Set ticket prices.
- Set admission quantities per ticket.
- Configure available quantities.
- Configure sales start and end dates.
- Enable or disable ticket categories.
- Configure early-bird pricing.
- Manage ticket availability.

### Order management

- View all ticket orders.
- Search orders.
- Filter by payment status.
- Filter by ticket category.
- View transaction details.
- View purchaser information.
- View associated admission tickets.
- Review failed and pending payments.
- Review refunds and cancellations.
- Export records where appropriate.

### Individual ticket management

- Search tickets by ticket ID.
- Search by attendee or purchaser details.
- View QR ticket information.
- View admission entitlement.
- View admissions consumed.
- View remaining admissions.
- View check-in history.
- Revoke or cancel tickets with appropriate authorization.
- Review suspicious or duplicate admission attempts.

### Sales analytics

Provide useful statistics:

- Total tickets sold.
- Total revenue from confirmed payments.
- Revenue by ticket category.
- Total successful transactions.
- Pending transactions.
- Failed transactions.
- Refunded transactions.
- Total admission entitlements sold.
- Total people checked in.
- Remaining admission entitlements.
- Attendance percentage.

Ensure financial reports use confirmed and reconciled transactions rather than simply counting ticket orders.

# 5. MOBILE TICKET VERIFICATION SYSTEM

Build a responsive, mobile-first ticket verification interface integrated into the existing OSAJA'20 application.

This will be used by event personnel at three entrance points.

The system must work on Android smartphones and tablets through a web browser.

Do not require a native Android application.

### Scanner functionality

- Access the device camera.
- Scan QR codes.
- Support traditional barcodes if technically appropriate.
- Provide manual ticket ID lookup.
- Automatically validate scanned tickets.
- Display immediate results.
- Display attendee or purchaser information as permitted.
- Display ticket category.
- Display admission entitlement.
- Display admissions already consumed.
- Display remaining admissions.
- Allow staff to select the number of attendees arriving.
- Support the Double ticket partial-admission workflow.
- Record every successful admission.

### Scanner interface states

Implement clearly distinguishable interfaces:

**VALID TICKET**
- Green success indicator.
- Ticket identification.
- Ticket category.
- Admission quantity.
- Remaining admission quantity.
- Admission confirmation.

**PARTIALLY USED TICKET**
- Clear indication that the ticket has already been partially used.
- Display previously consumed admissions.
- Display remaining admissions.
- Allow the remaining entitlement to be admitted.

**FULLY USED TICKET**
- Red rejection indicator.
- Display the previous admission history.
- Display the time and gate of previous admissions.

**INVALID TICKET**
- Unknown or malformed ticket.
- No admission.

**UNPAID TICKET**
- Payment not confirmed.
- No admission.

**CANCELLED OR REVOKED TICKET**
- Reject admission.

**NETWORK ERROR**
- Clearly explain whether verification is unavailable or whether an offline verification mode is active.
- Never falsely display a successful admission when the database has not confirmed it.

### Scanner experience

Make scanning fast and convenient.

- Provide a dedicated scanning screen.
- Provide camera permission handling.
- Prevent accidental repeated scans.
- Provide clear visual and audio feedback where appropriate.
- Allow staff to return to scanning immediately after a completed admission.
- Support different screen sizes.
- Provide a manual lookup fallback.
- Avoid unnecessary navigation during active event operations.

# 6. THREE-GATE MANAGEMENT

The event will have three entrance points.

Support multiple scanning devices operating simultaneously.

Each scanner must have:

- A registered device identity.
- An assigned gate.
- An authenticated staff account.
- Appropriate scanner permissions.
- A unique check-in activity record.

The administration dashboard should display activity across all three gates.

Administrators should be able to:

- Create and manage gates.
- Assign scanners to gates.
- Assign staff to gates.
- View activity by gate.
- View activity by staff member.
- Identify duplicate admission attempts.
- Monitor attendance across the event.

Do not assume that all staff members have administrative privileges.

# 7. STAFF AUTHENTICATION AND AUTHORIZATION

Reuse the existing OSAJA'20 authentication system wherever possible.

Implement role-based permissions.

Suggested roles:

**Event Administrator**
- Full ticket management access.
- Event configuration.
- Staff management.
- Financial reporting.
- Ticket management.
- Attendance reporting.

**Gate Supervisor**
- Monitor assigned entrance.
- Review ticket exceptions.
- Review admission history.
- Perform authorized manual admission overrides with a recorded reason.

**Scanner Staff**
- Access assigned scanner.
- Scan and validate tickets.
- Record admissions.
- View necessary ticket information.

Enforce authorization on the backend, not just through frontend route protection.

Prevent unauthorized users from accessing scanner operations or administrative functionality.

# 8. SUPABASE DATABASE AND SECURITY

Use the existing Supabase project.

Inspect the existing database schema before introducing migrations.

Design appropriate relational structures for:

- Events.
- Ticket categories.
- Ticket inventory.
- Ticket orders.
- Payment transactions.
- Individual ticket records.
- Admission entitlements.
- Admission/check-in records.
- Event gates.
- Scanner devices.
- Event staff assignments.
- Audit logs.

Adapt these structures to the existing schema rather than blindly creating duplicate tables.

### Database requirements

- Proper foreign keys.
- Appropriate indexes.
- Unique ticket identifiers.
- Unique secure ticket tokens.
- Referential integrity.
- Transaction-safe admission operations.
- Proper payment idempotency.
- Accurate financial records.
- Admission history preservation.
- Appropriate timestamps.

### Supabase security

Review and implement appropriate Row Level Security policies.

Never expose service-role credentials in the browser.

Never trust ticket identifiers or payment status supplied by the client without backend verification.

Implement secure server-side verification operations using the most suitable architecture already supported by the project.

### Atomic admission operation

The ticket admission operation is critical.

Implement it as an atomic operation.

For every scan:

1. Authenticate the staff member.
2. Validate scanner permissions.
3. Resolve the ticket securely.
4. Confirm payment and ticket validity.
5. Lock or safely claim the ticket record.
6. Read the remaining admission entitlement.
7. Validate the requested admission quantity.
8. Record the admission.
9. Update the consumed and remaining admission counts.
10. Return the authoritative result.

Simultaneous scans of the same ticket must never result in over-admission.

# 9. OFFLINE AND NETWORK FAILURE HANDLING

The preferred operation is online verification against Supabase.

However, the system must be designed for event-day network interruptions.

Inspect the existing application and determine the most reliable hybrid offline architecture.

Evaluate whether a shared local verification service, local database or another suitable mechanism is appropriate.

Do not assume that independent smartphone offline queues can guarantee duplicate prevention across three gates.

### Expected behaviour

When internet is available:
- Perform authoritative verification against the database.
- Update admission records.
- Synchronize gate activity.
- Update the administration dashboard.

When internet is unavailable:
- Detect the network failure.
- Clearly display offline mode.
- Preserve locally available ticket information securely.
- Avoid accepting tickets that cannot be safely verified.
- Queue only operations that can be reconciled safely.
- Maintain audit records.
- Synchronize pending records after connectivity returns.
- Detect conflicts.
- Never silently overwrite admission records.

The offline implementation must have explicit safeguards against admitting the same ticket at multiple gates.

If a fully reliable shared offline architecture cannot be achieved within the existing infrastructure, explain the limitation and provide the safest practical fallback.

# 10. USSD TICKETING INTEGRATION

OSAJA'20 also intends to support ticket purchases through USSD.

Inspect the existing integrations and determine whether a suitable USSD provider is already configured.

The architecture should allow USSD purchases to use the same ticket inventory, order creation, payment verification and ticket issuance services as web purchases.

Do not create a separate ticket database or independent ticket issuance mechanism for USSD.

If provider credentials, short-code provisioning or external approvals are unavailable, build the necessary integration abstraction and document the remaining configuration requirements.

Never simulate successful USSD payments.

# 11. NOTIFICATIONS AND TICKET DELIVERY

Use existing notification integrations where available.

Support:

- Ticket purchase confirmation.
- Payment confirmation.
- Ticket delivery.
- Ticket retrieval.
- Relevant event information.
- Appropriate payment failure notifications.

The QR code must be delivered in a usable format.

Protect ticket tokens and avoid exposing sensitive attendee information unnecessarily.

# 12. QR CODE AND BARCODE SECURITY

Use secure, unpredictable ticket tokens.

Do not encode confidential personal information directly into QR codes.

A QR code should contain only the information needed to securely identify or resolve a ticket.

Implement appropriate protections against:

- Forged ticket codes.
- Guessable ticket identifiers.
- Replayed admission attempts.
- Duplicate scans.
- Unauthorized manual admission.
- Token exposure.
- Unauthorized database updates.

The same ticket QR must remain valid for a Double ticket until its entire admission entitlement has been consumed or the ticket has been invalidated.

# 13. USER EXPERIENCE AND DESIGN

Follow the existing OSAJA'20 design system.

Do not introduce a visually unrelated application.

The ticket purchasing experience should be simple and professional.

The administration interface should provide organized ticket and event management.

The scanner interface should prioritize speed, readability and ease of use under event conditions.

Important considerations:

- Mobile-first layout.
- Clear status indicators.
- Large touch targets.
- Readable typography.
- Minimal steps during scanning.
- Appropriate loading states.
- Error handling.
- Empty states.
- Responsive dashboard layouts.
- Accessible interactions.

Avoid unnecessary animations, clutter and excessive dashboard cards.

# 14. TESTING AND VALIDATION

Do not consider the project complete merely because the interfaces render.

Implement meaningful automated tests.

### Ticket purchasing tests
- Successful payment.
- Failed payment.
- Pending payment.
- Duplicate webhook.
- Payment retry.
- Ticket issuance.
- Inventory exhaustion.

### Double ticket tests
- Two admissions together.
- One admission followed by another later.
- Repeated scan after full consumption.
- Invalid admission quantity.
- Concurrent admission attempts.
- Admission after cancellation.

### Scanner tests
- Valid ticket.
- Invalid ticket.
- Unpaid ticket.
- Cancelled ticket.
- Fully consumed ticket.
- Partially consumed ticket.
- Manual ticket lookup.
- Multiple devices.
- Different gates.

### Security tests
- Unauthorized scanner access.
- Unauthorized admin access.
- Invalid staff permissions.
- Forged ticket token.
- Duplicate admission attempts.
- Concurrent database operations.
- RLS enforcement.

### Offline tests
- Internet interruption.
- Reconnection.
- Pending synchronization.
- Duplicate synchronization.
- Cross-gate conflicts.
- Recovery from interrupted operations.

Create realistic test data and document how to run the tests.

# 15. DEVELOPMENT APPROACH

Work in structured phases, but aim to deliver the complete integrated system.

**Phase 1 — Repository and architecture inspection**
- Understand the existing codebase.
- Inspect Supabase configuration and schema.
- Identify authentication and admin systems.
- Identify payment and notification integrations.
- Document the proposed implementation architecture.

**Phase 2 — Database and backend**
- Implement required migrations.
- Implement secure ticket operations.
- Implement payment processing.
- Implement ticket issuance.
- Implement atomic admission verification.

**Phase 3 — Public ticket purchasing**
- Integrate ticket purchasing into the landing page.
- Implement order creation.
- Implement payment processing.
- Implement QR ticket generation and delivery.

**Phase 4 — Administrative ticket management**
- Integrate ticket management into the existing admin dashboard.
- Implement event, category, order, ticket and reporting management.

**Phase 5 — Scanner and event operations**
- Implement the mobile scanner.
- Implement staff and gate management.
- Implement Double ticket partial admissions.
- Implement multi-device synchronization.

**Phase 6 — Offline support**
- Implement the selected hybrid architecture.
- Test connectivity failures.
- Test recovery and synchronization.

**Phase 7 — Testing and production readiness**
- Run existing and newly introduced tests.
- Verify migrations.
- Verify authorization.
- Verify payment handling.
- Verify concurrency.
- Test mobile browsers.
- Document deployment and event-day operations.

Do not stop after creating a plan or mockup. Proceed with actual implementation.

If a critical external integration requires credentials or approval, implement the available portions and clearly document what is needed to activate it.

# 16. ENGINEERING RULES

- Preserve existing functionality.
- Follow existing project conventions.
- Reuse existing components and utilities.
- Avoid unnecessary dependencies.
- Avoid duplicated business logic.
- Keep modules maintainable.
- Avoid excessively large files.
- Do not hardcode secrets.
- Do not commit environment credentials.
- Use migrations for database changes.
- Include appropriate error handling.
- Maintain strong TypeScript typing where applicable.
- Avoid weakening existing security policies.
- Do not silently change existing database behaviour.
- Do not use mock data as production functionality.
- Do not claim an integration works without testing it.

Before implementation, inspect the project and make informed decisions about the technologies and locations of new modules.

If an architectural decision is uncertain, choose the most suitable approach based on the existing codebase and document the reasoning rather than arbitrarily imposing a new architecture.

# 17. COMPLETION REQUIREMENTS

The implementation is complete only when:

1. Customers can purchase tickets through the existing website.
2. Confirmed payments generate valid digital tickets.
3. Ticket categories and inventory are manageable through the existing admin dashboard.
4. Authorized event staff can access the mobile scanner.
5. Three entrance points can operate simultaneously.
6. Tickets can be validated securely.
7. Double tickets support partial admission and subsequent reuse of the same QR code.
8. Fully consumed tickets cannot be reused.
9. Admission activity is properly recorded.
10. Administrators can monitor event attendance.
11. Offline limitations and recovery procedures are implemented and tested.
12. Existing authentication and database security are preserved.
13. The implementation is documented and production-ready.

At completion, provide a concise engineering report covering:

- What was implemented.
- Important architectural decisions.
- Database migrations introduced.
- New and modified application routes.
- Payment and USSD integration status.
- Offline architecture and limitations.
- Security measures.
- Tests performed and results.
- Environment variables or credentials still required.
- Deployment instructions.
- Event-day operational instructions.

**Final instruction:** Treat this as a real event management and financial transaction system, not a demonstration project. Prioritize data integrity, secure payments, reliable admission verification, concurrency safety and operational reliability. Make the system work within the existing OSAJA'20 application rather than rebuilding what already exists.