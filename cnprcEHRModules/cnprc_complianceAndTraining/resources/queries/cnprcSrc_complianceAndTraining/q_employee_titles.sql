SELECT DISTINCT
CP_POSITION AS Title
FROM
cnprcSrc_complianceAndTraining.ZCRPRC_PERSON
WHERE CP_POSITION IS NOT NULL

UNION

SELECT DISTINCT
TPC_POSITION AS Title
FROM
cnprcSrc_complianceAndTraining.ZTRAIN_POSITION_CLASS;