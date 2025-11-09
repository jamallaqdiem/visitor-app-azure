-- SQL DDL SCRIPT FOR VISITOR TRACKING APPLICATION
-- Target: Azure SQL Database

-- 1. visitors Table: Stores  visitor information
IF OBJECT_ID('visitors', 'U') IS NOT NULL
    DROP TABLE visitors;
GO

CREATE TABLE visitors (
    -- Primary Key: Auto-incrementing unique ID
    id INT IDENTITY(1,1) PRIMARY KEY,

    -- Core Identification 
    first_name NVARCHAR(255) NOT NULL,
    last_name NVARCHAR(255) NOT NULL,
    
    -- Security / Access Control
    photo_path NVARCHAR(500) NULL, -- Path to the stored image file
    is_banned BIT NOT NULL DEFAULT 0, -- 0 = Not Banned, 1 = Banned
    
    -- Metadata 
    created_at DATETIMEOFFSET NOT NULL DEFAULT GETUTCDATE()
);
GO

-- 2. visits Table: Logs every single check-in and check-out event
IF OBJECT_ID('visits', 'U') IS NOT NULL
    DROP TABLE visits;
GO

CREATE TABLE visits (
    -- Primary Key
    id INT IDENTITY(1,1) PRIMARY KEY,

    -- Foreign Key to the visitors table
    visitor_id INT NOT NULL,

    -- Visit Details 
    entry_time DATETIMEOFFSET NOT NULL,
    exit_time DATETIMEOFFSET NULL, -- NULL until the visitor signs out
    
    -- Contact  Details 
    known_as NVARCHAR(255) NULL,
    address NVARCHAR(500) NULL,
    phone_number NVARCHAR(50) NULL,
    unit NVARCHAR(50) NOT NULL,
    reason_for_visit NVARCHAR(500) NULL,
    type NVARCHAR(50) NOT NULL, -- e.g., 'Guest', 'Contractor'
    company_name NVARCHAR(255) NULL, 
    mandatory_acknowledgment_taken BIT NOT NULL DEFAULT 0,

    -- Foreign Key Constraint
    CONSTRAINT FK_Visit_Visitor FOREIGN KEY (visitor_id) REFERENCES visitors(id)
);
GO

-- 3. dependents Table: Stores details of additional dependents linked to a primary visitor
IF OBJECT_ID('dependents', 'U') IS NOT NULL
    DROP TABLE dependents;
GO

CREATE TABLE dependents (
    -- Primary Key
    id INT IDENTITY(1,1) PRIMARY KEY,

    -- Dependent Details 
    full_name NVARCHAR(255) NOT NULL,
    age INT NULL,

    -- Foreign Key to the visits table (linking dependents to a specific check-in event)
    visit_id INT NOT NULL, 

    -- Foreign Key Constraint
    CONSTRAINT FK_Dependent_Visit FOREIGN KEY (visit_id) REFERENCES visits(id)
);
GO

-- 4. audit_logs Table: Stores records of internal actions
IF OBJECT_ID('audit_logs', 'U') IS NOT NULL
    DROP TABLE audit_logs;
GO

CREATE TABLE audit_logs (
    -- Primary Key
    id INT IDENTITY(1,1) PRIMARY KEY,

    -- Log Details 
    event_name NVARCHAR(255) NOT NULL,
    timestamp DATETIMEOFFSET NOT NULL DEFAULT GETUTCDATE(),
    status NVARCHAR(50) NOT NULL,
    profiles_deleted INT NULL,
    visits_deleted INT NULL,
    dependents_deleted INT NULL
);
GO

-- 5. Create Indexes for performance
CREATE NONCLUSTERED INDEX IX_visits_OnSite ON visits (exit_time) INCLUDE (visitor_id, entry_time);
CREATE UNIQUE NONCLUSTERED INDEX IX_visitors_FullName ON visitors (first_name, last_name);
GO
