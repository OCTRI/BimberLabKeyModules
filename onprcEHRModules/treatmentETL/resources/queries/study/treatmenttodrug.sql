SELECT t.id,
t.calculated_status,
t.lsid,
t.dataset,
t.animalid,
t.time,
t.hours,
t.minutes,
t.origDate,
t.timeType,
t.category,
t.frequency,
t.startDate,
t.daysElapsed,
t.enddate,
t.project,
t.code,
t.volume,
t.vol_units,
t.concentration,
t.conc_units,
t.amount,
t.amount_units,
t.amountWithUnits,
t.amountAndVolume,
t.dosage,
t.dosage_units,
t.qualifier,
t.route,
t.reason,
t.performedby,
t.remark,
t.chargeType,
t.billable,
t.taskid,
t.qcstate,
t.date,
t.timeOfDay,
t.timeOffset,
t.treatmentid,
t.treatmentStatus
FROM treatmentScheduleUpdate t left outer join Drug d on t.id = d.id and t.code = d.code and t.date = d.date
where d.id is null and d.date is null and d.code is null