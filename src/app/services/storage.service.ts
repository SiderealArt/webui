import { Injectable } from '@angular/core';
import { WebSocketService } from './ws.service';
import { RestService } from './rest.service';

import * as moment from 'moment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { parse } from 'url';

@Injectable()
export class StorageService {
  protected diskResource: string = 'disk.query';

  public ids: any;
  public diskNames: any;
  public hddStandby: any;
  public diskToggleStatus: boolean;
  public SMARToptions: any;
  public advPowerMgt: any;
  public acousticLevel: any;
  public humanReadable: any;

  unitLetters  = 'bkmgtp';
  powersOf1024 = {b: 1, k: 1024, m: 1024**2, g: 1024**3, t: 1024**4, p: 1024**5};
  IECUnitsRE   = 'kib|mib|gib|tib|pib';
  shortUnitsRE = 'kb|mb|gb|tb|pb';

  constructor(protected ws: WebSocketService, protected rest: RestService) {}

  filesystemStat(path: string) {
    return this.ws.call('filesystem.stat', [path])
  }

  listDisks() {
    return this.ws.call(this.diskResource, []);
  }

  downloadFile(filename, contents, mime_type){
    mime_type = mime_type || "text/plain";

    let byteCharacters = atob(contents);

    let byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    let byteArray = new Uint8Array(byteNumbers);

    let blob = new Blob([byteArray], {type: mime_type});

    let dlink = document.createElement('a');
    document.body.appendChild(dlink);
    dlink.download = filename;
    dlink.href =  window.URL.createObjectURL(blob);
    dlink.onclick = function(e) {
        // revokeObjectURL needs a delay to work properly
        var that = this;
        setTimeout(function() {
            window.URL.revokeObjectURL(that['href']);
        }, 1500);
    };

    dlink.click();
    dlink.remove();
  }

  // Handles sorting for entity tables and some other ngx datatables 
  tableSorter(arr, key, asc) {
    let tempArr = [],
      sorter,
      myCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    
    // Breaks out the key to sort by
    arr.forEach((item) => {
      tempArr.push(item[key]);
    });
    // Handle an empty data field or empty column
    let n = 0;
    while (!tempArr[n] && n < tempArr.length) {
      n++;
    }
    // Select table columns labled with GiB, Mib, etc
    // Regex checks for ' XiB' with a leading space and X === K, M, G or T 
    if (typeof(tempArr[n]) === 'string' && 
      (tempArr[n].slice(-2) === ' B' || /\s[KMGT]iB$/.test(tempArr[n].slice(-4) ))) {

    let bytes = [], kbytes = [], mbytes = [], gbytes = [], tbytes = [];
    for (let i of tempArr) {
      if (i.slice(-2) === ' B') {
        bytes.push(i);
      } else {
        switch (i.slice(-3)) {
          case 'KiB':
            kbytes.push(i);
            break;
          case 'MiB':
            mbytes.push(i);
            break;
          case 'GiB':
            gbytes.push(i);
            break;
          case 'TiB':
            tbytes.push(i);
        }
      }
    }

    // Sort each array independently, then put them back together
    bytes = bytes.sort(myCollator.compare);
    kbytes = kbytes.sort(myCollator.compare);
    mbytes = mbytes.sort(myCollator.compare);
    gbytes = gbytes.sort(myCollator.compare);
    tbytes = tbytes.sort(myCollator.compare);
    
    sorter = bytes.concat(kbytes, mbytes, gbytes, tbytes)

  // Select disks where last two chars = a digit and the one letter space abbrev  
  } else if (typeof(tempArr[n]) === 'string' && 
      tempArr[n][tempArr[n].length-1].match(/[KMGTB]/) &&
      tempArr[n][tempArr[n].length-2].match(/[0-9]/)) {
        
      let B = [], K = [], M = [], G = [], T = [];
      for (let i of tempArr) {
        switch (i.slice(-1)) {
            case 'B':
              B.push(i);
              break;
            case 'K':
              K.push(i);
              break;
            case 'M':
              M.push(i);
              break;
            case 'G':
              G.push(i);
              break;
            case 'T':
              T.push(i);
          }
        }

      // Sort each array independently, then put them back together
      B = B.sort(myCollator.compare);
      K = K.sort(myCollator.compare);
      M = M.sort(myCollator.compare);
      G = G.sort(myCollator.compare);
      T = T.sort(myCollator.compare);
      
      sorter = B.concat(K, M, G, T)
  
    // Select strings that Date.parse can turn into a number (ie, that are a legit date)
    } else if (typeof(tempArr[n]) === 'string' && 
      !isNaN(Date.parse(tempArr[n]))) {
        let timeArr = [];
        for (let i of tempArr) {
          timeArr.push(Date.parse(i));
        }
        timeArr = timeArr.sort();

        sorter = [];
        for (let elem of timeArr) {
         sorter.push(moment(elem).format('l LT'));
        }
      }
    else {
      sorter = tempArr.sort(myCollator.compare);
    }
      // Rejoins the sorted keys with the rest of the row data
      let v;
      // ascending or decending
      asc==='asc' ? (v = 1) : (v = -1);
      arr.sort((a, b) => {
        const A = a[key],
            B = b[key];
        if (sorter.indexOf(A) > sorter.indexOf(B)) {
            return 1 * v;
        } else {
            return -1 * v;
        }
      });
          
    return arr;
  } 

  // This section passes data from disk-list to disk-bulk-edit form
  diskIdsBucket(arr) {
    this.ids = arr;
  }

  diskNamesBucket(arr) {
    this.diskNames = arr;
  }

  diskToggleBucket(bool) {
    this.diskToggleStatus = bool;
  }

  diskNameSort(disks) {
    for (let i = 0; i < disks.length; i++) {
      for (let j = 0; j < disks.length - i - 1; j++) {
        const k = j + 1;
        const disk1name = disks[j].match(/\w+/);
        const disk1num = parseInt(disks[j].match(/\d+/), 10);
        const disk2name = disks[k].match(/\w+/);
        const disk2num = parseInt(disks[k].match(/\d+/), 10);

        if (disk1name > disk2name || disk1num > disk2num) {
          const temp = disks[j];
          disks[j] = disks[k];
          disks[k] = temp;
        }
      }
    }
  }

  poolUnlockServiceChoices(): Observable<{ label: string; value: string; }[]> {
    return this.ws.call("pool.unlock_services_restart_choices", []).pipe(
      map((response: { [serviceId: string]: string }) =>
        Object.keys(response || {}).map(serviceId => ({
            label: response[serviceId],
            value: serviceId
        }))
      )
    );
  }

  getDatasetNameOptions(): Observable<{ label: string; value: string }[]> {
    return this.ws
      .call("pool.filesystem_choices")
      .pipe(map(response => response.map(value => ({ label: value, value }))));
  }

  /**
   * @param path The path of the dataset excluding "/mnt/"
   */
  isDatasetTopLevel(path: string): boolean {
    if (typeof path !== 'string') {
      throw new Error('isDatasetTopLevel received "path" parameter that is not of type "string."');
    }

    /**
     * Strip leading forward slash if present
     * /zpool/d0 -> zpool/d0
     */
    path = path.indexOf('/') === 0 ? path.substr(1) : path;

    return path.indexOf('/') < 0;
  }

  convertUnitToNum(unit) {
    unit = unit.toString().toLowerCase();
    let unitRe = new RegExp(`[${this.unitLetters}]`);
    // return a multiplier of one if it is not a known unit
    if (!unit.match(unitRe)) {
        return 1;
    }
    return parseInt(this.powersOf1024[unit]);
  }

  convertIECUnitsToHuman(unitStr) {
    // convert IEC units like "MiB", "GiB" to "m" and "g"
    let unitStrRE = new RegExp(this.IECUnitsRE);
    unitStr = unitStr.toLowerCase();
    if (unitStr.match(unitStrRE)) {
        unitStr = unitStr.replace('ib', '');
    }
    return unitStr;
  }

  convertShortUnitsToHuman(unitStr) {
    // convert human units like "MB", "GB" to "m" and "g"
    let unitStrRE = new RegExp(this.shortUnitsRE);
    unitStr = unitStr.toLowerCase();
    if (unitStr.match(unitStrRE)) {
        unitStr = unitStr.replace('b', '');
    }
    return unitStr;
  }

  convertHumanStringtoNum(hstr) {
    // return values are an array:
    // values[0] is the numeric value
    // values[1] is the normalized string

    let values, results, num;

    hstr = hstr.toLowerCase()
    hstr = this.convertIECUnitsToHuman(hstr);
    hstr = this.convertShortUnitsToHuman(hstr);

    if (!hstr) {
        values = [0, '0']
        this.humanReadable = values[1];
        return values[0];
    }

    // input must include numbers
    // RE must use double backslashes because of backtick and interpolation here
    var valueRe = new RegExp(`^\\s*(\\d+)\\s*([${this.unitLetters}]*)\\s*$`);
    if ( results = hstr.match(valueRe) ) {
        // has at least a number
        num = parseInt(results[1]);
    } else {
        values = [NaN, ''];
        this.humanReadable = values[1];
        return values[0];
    }

    var unit = results[2];
    // ignore 'b' for bytes
    unit = (unit === 'b') ? '' : unit;
    values = [num * this.convertUnitToNum(unit), num.toString() + unit];
    this.humanReadable = values[1];
    return values[0];
  }

}
