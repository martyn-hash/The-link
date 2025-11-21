# CSV Import Guide - The Link CRM

## Overview

The Link CRM provides a powerful CSV import system that allows you to bulk-import your client data, people (contacts), client services, and work role assignments. The import process validates all data before making any changes to your database, ensuring data integrity throughout the process.

**What You Can Import:**
- Clients (companies or individuals)
- People (contacts) and their relationships to clients
- Client Services (scheduled services for clients)
- Role Assignments (assign users to work on specific services)

**Key Features:**
- **Validation First**: All data is validated before any database changes occur
- **Transactional Import**: If anything fails, nothing is imported (all-or-nothing approach)
- **Template Downloads**: Get correctly formatted CSV templates to guide your data preparation
- **Preview Before Import**: Review exactly what will be imported before committing
- **Detailed Error Messages**: Clear guidance on any issues with your data

---

## Prerequisites

### 1. System Setup Requirements

Before importing data, ensure the following are configured in your system:

#### A. Services Must Exist
The services you reference in your CSV files must already exist in the system. Common services include:
- Weekly Payroll Processing
- Monthly Bookkeeping
- Quarterly VAT Return
- Annual Company Accounts
- Companies House Confirmation Statement
- Daily Cash Flow Review

**To add services**: Navigate to Admin → Services and create any services you'll be importing.

#### B. Work Roles Must Exist
Work roles that you'll assign to services must be pre-configured. Common work roles include:
- Bookkeeper
- Client Manager
- Admin
- Manager

**To add work roles**: Navigate to Admin → Work Roles and create the roles you need.

#### C. Users Must Exist
Any users (service owners or role assignees) referenced in your CSV must already have accounts in the system with verified email addresses.

**To add users**: Navigate to Admin → Users and create user accounts.

---

## Step-by-Step Import Process

### Step 1: Access the Import Page

1. Log in to The Link CRM
2. Navigate to the **Data Import** page
3. You'll see a 5-step progress indicator: Upload → Validate → Preview → Import → Complete

### Step 2: Download CSV Templates

Click the **"Download Template CSV Files"** button. This will download three template files to your computer:

1. `1_clients_and_people_template.csv`
2. `2_client_services_template.csv`
3. `3_role_assignments_template.csv`

**Important**: These templates show you the exact column structure and formatting required. Use them as a starting point for your data.

### Step 3: Prepare Your CSV Files

#### File 1: Clients & People Master Data

**Purpose**: Define your clients (companies/individuals) and their associated contacts (people).

**Required Columns:**
- `client_ref` - Your unique reference for the client (e.g., CLI001, CLI002)
- `client_name` - Full name of the client/company
- `client_type` - Either "company" or "individual"
- `client_email` - Primary email for the client (optional)
- `company_number` - UK Companies House number if applicable (optional)
- `person_ref` - Your unique reference for the person (e.g., PER001)
- `person_full_name` - Full name of the contact person
- `person_email` - Email address of the person (optional)
- `person_telephone` - Telephone number (optional)
- `person_primary_phone` - Primary phone in international format, e.g., +447123456789 (optional)
- `person_primary_email` - Primary email for communications (optional)
- `officer_role` - Role of the person (e.g., director, secretary, shareholder) (optional)
- `is_primary_contact` - "yes" or "no" to indicate primary contact

**Example:**
```csv
client_ref,client_name,client_type,client_email,company_number,person_ref,person_full_name,person_email,person_telephone,person_primary_phone,person_primary_email,officer_role,is_primary_contact
CLI001,Example Ltd,company,info@example.com,12345678,PER001,John Doe,john@example.com,01234567890,+447123456789,john@example.com,director,yes
CLI001,Example Ltd,company,info@example.com,12345678,PER002,Jane Smith,jane@example.com,01234567891,+447123456790,jane@example.com,secretary,no
CLI002,Bob's Consulting,individual,bob@consulting.com,,PER003,Bob Johnson,bob@consulting.com,01234567892,+447123456791,bob@consulting.com,,yes
```

**Key Points:**
- Each row can define ONE client-person relationship
- To link multiple people to one client, repeat the client details on multiple rows with different person details
- Client references (`client_ref`) must be unique across all your clients
- Person references (`person_ref`) must be unique across all your people
- `client_type` must be exactly "company" or "individual" (case-sensitive)
- Use "yes" or "no" for `is_primary_contact` (case-insensitive)

#### File 2: Client Services

**Purpose**: Link clients to services and set up their scheduling details.

**Required Columns:**
- `client_ref` - Must match a client_ref from File 1
- `service_name` - Must match an existing service in the system (case-sensitive)
- `service_owner_email` - Email of the user who owns this service (must exist in system)
- `frequency` - One of: daily, weekly, fortnightly, monthly, quarterly, annually
- `next_start_date` - Next start date in DD/MM/YYYY format (e.g., 01/12/2024)
- `next_due_date` - Next due date in DD/MM/YYYY format (e.g., 15/12/2024)
- `is_active` - "yes" or "no" to indicate if the service is active

**Example:**
```csv
client_ref,service_name,service_owner_email,frequency,next_start_date,next_due_date,is_active
CLI001,Monthly Bookkeeping,admin@example.com,monthly,01/12/2024,15/12/2024,yes
CLI001,Quarterly VAT Return,admin@example.com,quarterly,01/01/2025,31/01/2025,yes
CLI002,Weekly Payroll Processing,payroll@example.com,weekly,02/12/2024,06/12/2024,yes
```

**Key Points:**
- `client_ref` must match exactly with a client from File 1
- `service_name` must match exactly (including capitalization) with a service already created in the system
- `service_owner_email` must belong to an existing user account
- `frequency` must be one of the six valid options (case-sensitive)
- Dates must be in DD/MM/YYYY format
- Use "yes" or "no" for `is_active`

#### File 3: Role Assignments

**Purpose**: Assign users to specific work roles for each client service.

**Required Columns:**
- `client_ref` - Must match a client_ref from File 1
- `service_name` - Must match the service_name from File 2 for this client
- `work_role_name` - Must match an existing work role in the system (case-sensitive)
- `assigned_user_email` - Email of the user assigned to this role (must exist in system)
- `is_active` - "yes" or "no" to indicate if the assignment is active

**Example:**
```csv
client_ref,service_name,work_role_name,assigned_user_email,is_active
CLI001,Monthly Bookkeeping,Bookkeeper,bookkeeper@example.com,yes
CLI001,Monthly Bookkeeping,Client Manager,manager@example.com,yes
CLI001,Quarterly VAT Return,Bookkeeper,bookkeeper@example.com,yes
CLI002,Weekly Payroll Processing,Bookkeeper,payroll@example.com,yes
```

**Key Points:**
- `client_ref` and `service_name` must match exactly with entries in File 2
- `work_role_name` must match exactly (including capitalization) with a work role already created in the system
- `assigned_user_email` must belong to an existing user account
- Multiple roles can be assigned to the same service
- Use "yes" or "no" for `is_active`

### Step 4: Upload Your CSV Files

1. On the Data Import page, you'll see three upload sections
2. Click **"Choose File"** for each section and select your prepared CSV file:
   - Section 1: Upload your Clients & People CSV
   - Section 2: Upload your Client Services CSV
   - Section 3: Upload your Role Assignments CSV
3. You'll see a green checkmark next to each successfully selected file
4. Once all three files are selected, click **"Parse and Validate Files"**

### Step 5: Review Validation Results

The system will validate your data against the following rules:

**Validation Checks:**
- ✓ All required fields are present
- ✓ Client references are consistent across all files
- ✓ Service names match existing services in the system
- ✓ Work role names match existing roles in the system
- ✓ User email addresses match existing user accounts
- ✓ Frequency values are valid
- ✓ Client types are valid (company or individual)
- ✓ Date formats are correct

**Possible Outcomes:**

**A. Validation Success (Green Alert)**
- Message: "Data Validated Successfully"
- You'll see a summary: "Ready to import X client records, Y service mappings, and Z role assignments"
- Proceed to Step 6

**B. Validation Errors (Red Alert)**
- The system will display specific error messages
- Each error tells you exactly what's wrong and where
- Example: "Service 'Monthly Accounting' not found in system. Available services include: Monthly Bookkeeping, Weekly Payroll Processing..."
- Fix the errors in your CSV files and re-upload

**C. Validation Warnings (Yellow/Orange Alert)**
- Warnings indicate potential issues but won't block the import
- Review warnings carefully before proceeding

### Step 6: Preview Your Data

If validation passes, you'll see three tabs to preview your data:

**Clients & People Tab**
- Shows all client-person relationships that will be created
- Displays: Client Ref, Client Name, Type, Person, Role
- Preview shows first 10 rows (full import will include all rows)

**Services Tab**
- Shows all client service mappings that will be created
- Displays: Client Ref, Service, Frequency, Start Date, Due Date
- Verify dates are correct and services are properly assigned

**Role Assignments Tab**
- Shows all user-role assignments for services
- Displays: Client Ref, Service, Work Role, Assigned User
- Ensure correct users are assigned to each role

**Action Buttons:**
- **"Back to Upload"**: Return to file upload to make changes
- **"Execute Import"**: Proceed with the import (only enabled if validation passed)

### Step 7: Execute the Import

1. Review all preview tabs carefully
2. Click **"Execute Import"** button
3. You'll see a progress indicator during the import
4. The import runs as a database transaction - either everything imports successfully or nothing imports at all

### Step 8: Review Import Results

**Success:**
- Green alert: "Import Complete"
- Summary showing:
  - X clients created
  - Y people created
  - Z relationships created
  - A services created
  - B roles assigned
- All data is now in your system and ready to use

**Failure:**
- Red alert with error details
- No data has been imported
- Review the error message
- Fix the issue and restart the import process

---

## Common Import Scenarios

### Scenario 1: Import New Clients with Multiple Contacts

**CSV Structure:**
```csv
client_ref,client_name,client_type,client_email,company_number,person_ref,person_full_name,person_email,person_telephone,person_primary_phone,person_primary_email,officer_role,is_primary_contact
ABC001,ABC Ltd,company,info@abc.com,12345678,P001,Alice Director,alice@abc.com,02012345678,+447700900000,alice@abc.com,director,yes
ABC001,ABC Ltd,company,info@abc.com,12345678,P002,Bob Secretary,bob@abc.com,02012345679,+447700900001,bob@abc.com,secretary,no
ABC001,ABC Ltd,company,info@abc.com,12345678,P003,Charlie Shareholder,charlie@abc.com,02012345680,+447700900002,charlie@abc.com,shareholder,no
```

This creates:
- 1 client (ABC Ltd)
- 3 people (Alice, Bob, Charlie)
- 3 client-person relationships with different roles

### Scenario 2: Import Services with Different Frequencies

```csv
client_ref,service_name,service_owner_email,frequency,next_start_date,next_due_date,is_active
ABC001,Weekly Payroll Processing,admin@firm.com,weekly,02/12/2024,06/12/2024,yes
ABC001,Monthly Bookkeeping,admin@firm.com,monthly,01/12/2024,15/12/2024,yes
ABC001,Quarterly VAT Return,tax@firm.com,quarterly,01/01/2025,31/01/2025,yes
ABC001,Annual Company Accounts,accounts@firm.com,annually,01/04/2025,30/06/2025,yes
```

This creates 4 services for one client with different frequencies and owners.

### Scenario 3: Assign Multiple Roles to One Service

```csv
client_ref,service_name,work_role_name,assigned_user_email,is_active
ABC001,Monthly Bookkeeping,Bookkeeper,junior@firm.com,yes
ABC001,Monthly Bookkeeping,Client Manager,manager@firm.com,yes
ABC001,Monthly Bookkeeping,Admin,admin@firm.com,yes
```

This assigns 3 different users with 3 different roles to one service.

---

## Troubleshooting Guide

### Error: "Missing client_ref in clients data"
**Cause**: A row in your Clients & People CSV is missing the client_ref column
**Solution**: Ensure every row has a value in the client_ref column

### Error: "Client ref XXX in services not found in clients data"
**Cause**: You referenced a client_ref in the Services CSV that doesn't exist in the Clients CSV
**Solution**: 
1. Check for typos in client_ref values
2. Ensure the client_ref exists in your Clients & People CSV
3. Client references are case-sensitive

### Error: "Service 'XXX' not found in system"
**Cause**: The service name doesn't match any existing service in your system
**Solution**:
1. Go to Admin → Services to see available services
2. Copy the exact service name (including capitalization)
3. OR create the service in the system first, then import

### Error: "Invalid frequency for XXX. Must be one of: daily, weekly, fortnightly, monthly, quarterly, annually"
**Cause**: The frequency value is misspelled or not one of the allowed values
**Solution**: Use exactly one of these values (case-sensitive):
- daily
- weekly
- fortnightly
- monthly
- quarterly
- annually

### Error: "Work role 'XXX' not found in system"
**Cause**: The work role name doesn't match any existing role in your system
**Solution**:
1. Go to Admin → Work Roles to see available roles
2. Copy the exact role name (including capitalization)
3. OR create the work role in the system first, then import

### Error: "User with email 'XXX' not found in system"
**Cause**: The email address doesn't belong to any user account
**Solution**:
1. Go to Admin → Users to verify the email address
2. Create the user account if needed
3. Ensure the email is spelled correctly (case-insensitive)

### Error: "Invalid client_type for XXX. Must be 'company' or 'individual'"
**Cause**: The client_type column contains a value other than "company" or "individual"
**Solution**: Change the value to exactly "company" or "individual" (lowercase)

### Date Format Issues
**Cause**: Dates are in wrong format (e.g., MM/DD/YYYY instead of DD/MM/YYYY)
**Solution**: Use DD/MM/YYYY format consistently:
- Correct: 01/12/2024 (1st December 2024)
- Incorrect: 12/01/2024 (this would be interpreted as 12th January 2024)

### CSV File Encoding Issues
**Cause**: Special characters appear as strange symbols
**Solution**: 
1. Save your CSV files with UTF-8 encoding
2. In Excel: Save As → CSV UTF-8 (Comma delimited)
3. In Google Sheets: Download → Comma-separated values (.csv)

### Extra Spaces in Data
**Cause**: Leading or trailing spaces in your values
**Solution**: The system automatically trims spaces, but it's good practice to:
1. Remove extra spaces before and after values
2. Use Excel/Google Sheets TRIM() function if needed

---

## Best Practices

### 1. Start Small
- Import a few test records first (2-3 clients)
- Verify the results in the system
- Then proceed with your full data set

### 2. Use Reference Numbers Consistently
- Create a simple naming scheme for your references
- Examples: CLI001, CLI002... for clients; PER001, PER002... for people
- Keep a master reference list

### 3. Prepare Your System First
- Create all services before importing
- Create all work roles before importing
- Create all user accounts before importing
- This prevents validation errors

### 4. Clean Your Data
- Remove duplicate records
- Verify email addresses are valid
- Ensure phone numbers are in correct format
- Check for spelling errors in names

### 5. Backup Before Import
- Although imports are transactional, it's good practice to backup your data
- Consider doing imports during low-usage times

### 6. Document Your Process
- Keep a copy of your import CSV files
- Note any transformations you made to your data
- Document your reference numbering scheme

### 7. Validate Externally First
- Check your CSV files in Excel/Google Sheets before uploading
- Look for empty cells in required columns
- Verify date formats
- Check for special characters that might cause issues

---

## Data Requirements Reference

### Client Types
Must be one of:
- `company` - For registered companies
- `individual` - For sole traders or individuals

### Frequency Options
Must be one of:
- `daily` - Runs every day
- `weekly` - Runs once per week
- `fortnightly` - Runs every two weeks
- `monthly` - Runs once per month
- `quarterly` - Runs four times per year
- `annually` - Runs once per year

### Yes/No Fields
For `is_active` and `is_primary_contact`:
- Use "yes" for true (case-insensitive)
- Use "no" for false (case-insensitive)
- Anything other than "yes" is treated as "no"

### Date Format
- **Required format**: DD/MM/YYYY
- **Examples**: 
  - 01/12/2024 (1st December 2024)
  - 25/12/2024 (25th December 2024)
  - 31/03/2025 (31st March 2025)

### Phone Numbers
- **Primary Phone**: Use international format, e.g., +447123456789
- **Regular Phone**: Any format, e.g., 01234567890

### Email Addresses
- Must be valid email format
- Case-insensitive
- Must match existing user accounts for service owners and role assignees

---

## Advanced Tips

### Importing Clients Without Services
If you only want to import clients and people without services:
1. Upload your Clients & People CSV
2. Create empty Services and Role Assignments CSVs with just headers:
   ```csv
   client_ref,service_name,service_owner_email,frequency,next_start_date,next_due_date,is_active
   ```
   ```csv
   client_ref,service_name,work_role_name,assigned_user_email,is_active
   ```
3. Upload all three files

### Re-importing Data
- The system creates NEW records on each import
- It does NOT update existing records
- If you need to update existing data, use the individual client/service edit features
- To replace data: manually delete existing records first, then import

### Large Imports
- The system can handle hundreds or thousands of records
- For very large imports (1000+ rows), consider breaking into batches
- This makes troubleshooting easier if issues arise

### Excel Formula Helpers
Create a helper column in Excel to generate client_ref values:
```excel
="CLI" & TEXT(ROW()-1, "000")
```
This creates CLI001, CLI002, CLI003, etc.

For person_ref:
```excel
="PER" & TEXT(ROW()-1, "000")
```

---

## Support and Help

If you encounter issues not covered in this guide:

1. **Check Validation Messages**: They usually tell you exactly what's wrong
2. **Review Examples**: Compare your CSV structure to the examples in this guide
3. **Start Fresh**: Download new templates and start with a small test dataset
4. **System Status**: Ensure all prerequisites (services, roles, users) are properly configured

Remember: The import validation is designed to catch errors BEFORE any data is changed. If validation passes, your import will succeed!

---

## Quick Reference Checklist

Before importing, verify:

- [ ] All required services are created in the system
- [ ] All required work roles are created in the system
- [ ] All required user accounts exist with correct email addresses
- [ ] CSV files are saved with UTF-8 encoding
- [ ] All client_ref values are unique in Clients & People CSV
- [ ] All person_ref values are unique in Clients & People CSV
- [ ] client_ref values are consistent across all three CSV files
- [ ] Service names match exactly (including capitalization)
- [ ] Work role names match exactly (including capitalization)
- [ ] User email addresses match existing accounts
- [ ] client_type is either "company" or "individual"
- [ ] frequency is one of the six valid options
- [ ] Dates are in DD/MM/YYYY format
- [ ] is_active and is_primary_contact use "yes" or "no"
- [ ] No empty values in required fields

Good luck with your import!
