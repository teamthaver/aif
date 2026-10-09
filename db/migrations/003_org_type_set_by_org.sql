-- The organization's type is chosen by the organization itself (its org admin), not by the system admin who creates it.
-- So it starts empty and is filled in later. Existing values are kept.
ALTER TABLE organizations MODIFY type ENUM('AIF manager','Fund administrator','Trustee','Custodian') NULL DEFAULT NULL;
