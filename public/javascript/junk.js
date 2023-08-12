function reportOwner() {
    var owner = Sheets.Spreadsheets.Values.get(spreadsheetId, 'ownerSelected', getOption).values;
    var key;
    var data = [];
    var cnt = 0;
    if (typeof owner === 'undefined') {
        ui.alert('Homeowner must be selected from drop-down to create report. Try again.');
        return;
    } else {
        key = owner[0][0].substring(0, 4);
    }

    data = getLedgerData('owner', key);
    // if no data returned stop report creation
    cnt = data.length;
    if (cnt === 0) {
        ui.alert('No Homeowner data located. Cannot create report.');
        return;
    }

    var name = data[0][2];
    var house = data[0][1];
    var line, type, comment, amount, trxDate;
    var newData = [];

    for (var i = 0; i < data.length; i++) {
        line = [];

        switch (data[i][5]) {
            case 'Pay Dues':
                type = data[i][5];
                amount = data[i][3];
                break;
            case 'Pay Assess':
                type = data[i][5];
                amount = data[i][3];
                break;
            case 'Income':
                type = 'Pay Other';
                amount = data[i][3];
                break;
            case 'Bill Dues':
                type = data[i][5];
                amount = data[i][4];
                break;
            case 'Bill Assess':
                type = data[i][5];
                amount = data[i][4];
                break;
            default:
            // Do nothing
        }
        // Complete getting data

        // Comment
        if (typeof data[i][10] !== 'undefined') {
            if (data[i][10].trim() !== '') {
                comment = data[i][10].trim();
            }
        } else {
            comment = " ";
        }

        // Date
        if (typeof data[i][11] !== 'undefined') {
            if (data[i][11] !== '') {
                trxDate = data[i][11];
            }
        } else {
            trxDate = ' ';
        }
        line = [trxDate, type, comment, amount]
        newData.push(line);

    }
}