//-----------------------------------------------------------------------------
// VPK objects that are not reset when new snapshot is loaded.
// These data varaibles need to 'span' the reset.
//-----------------------------------------------------------------------------
let vpkSpan = {
    readyz: {},
    do_not_delete: 'do not delete',
};
export default vpkSpan;
