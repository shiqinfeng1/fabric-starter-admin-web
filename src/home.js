import {inject, LogManager} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';
import {IdentityService} from './services/identity-service';
import {ChaincodeService} from './services/chaincode-service';
import {ConfigService} from './services/config-service';
import {AlertService} from './services/alert-service';
import {ConsortiumService} from './services/consortium-service';
import {WebAppService} from './services/webapp-service';
import JSONFormatter from '../node_modules/json-formatter-js/dist/json-formatter';

let log = LogManager.getLogger('Home');

@inject(IdentityService, EventAggregator, ChaincodeService, ConfigService, AlertService, ConsortiumService, WebAppService)
export class Home {
//Blocks
  blocks = []; // list of blocks
//Channels
  channelList = []; // list of channels
  channel = null; // chosen channel
  channelJoin = null;
  channelNew = null;
//Consortium
  consortiumInviteeIP = null;
  consortiumInviteeName = null;
  consortiumMembersList = [];
//Install Chaincode
  installLanguage = 'node';
  installedChaincodes = [];
  installVersion = null;
  chaincodeFile = null;
//Instantiate chaincodes
  selectedChaincode = null;
  selectedChain = null;
  initLanguage = 'node';
  initFcn = null;
  initArgs = null;
  chaincodeList = [];
  policy = null;
  orgs = [];
  privateCollectionFile = null;
//ADD orgs to channel
  orgList = [];
  newOrg = null;
//Uploaded WebApps
  installedWebApps = [];
  webAppFile = null;
//Uploaded Middlewares
  installedMiddlewares = [];
  middlewareFile = null;
//Operation
  operation = false;
  fnc = null;
  args = null;
  value = null;
  targets = [];
  targs = [];
//Info
  lastTx = null;
  creator = null;
  creatorCert = null;
  endorses = [];
  endorsesCert = [];
  block = null;
  show = false;
  qu = false;

//Load
  load = true;
  loadAdd = true;
  loadJ = true;
  loadI = true;

  type = 'none';
  policyType = ['None', 'Any', 'All', 'Majority'];
  pol = true;
  selectedRoles = [];
  jsonPolicy = {
    identities: [],
    policy: {}
  };

  constructor(identityService, eventAggregator, chaincodeService, configService, alertService, consortiumService, webAppService) {
    this.identityService = identityService;
    this.eventAggregator = eventAggregator;
    this.chaincodeService = chaincodeService;
    this.configService = configService;
    this.alertService = alertService;
    this.consortiumService = consortiumService;
    this.webAppService = webAppService;
  }

  attached() {
    // this.queryConsortium();
    this.queryChannels();
    this.queryInstalledChaincodes();
    this.queryInstalledWebApps();
    this.subscriberBlock = this.eventAggregator.subscribe('block', o => {
      log.debug('block', o);
      this.queryChannels();
      if (o.channel_id === this.channel)
        this.updateBlock();
      if (this.channel) {
        this.queryChaincodes();
        this.queryOrgs();
        this.queryPeers();
      }
    });
  }

  detached() {
    this.subscriberBlock.dispose();
  }

  queryChannels() {
    this.chaincodeService.getChannels().then(channels => {
      this.channelList = channels;
      this.channelList.sort();
    });
  }

  addChannel() {
    this.alertService.info('Sent create channel request');
    this.loadAdd = false;
    this.chaincodeService.addChannel(this.channelNew).then(() => {
      this.loadAdd = true;
    }).catch(() => {
      this.loadAdd = true;
    });
    this.channelList.sort();
    this.channelNew = null;
  }

  joinChannel() {
    this.alertService.info('Sent join channel request');
    this.loadJ = false;
    this.chaincodeService.joinChannel(this.channelJoin).then(j => {
      this.loadJ = true;
    }).catch(() => {
      this.loadJ = true;
    });
    this.channelJoin = null;
  }

  queryInstalledChaincodes() {
    this.chaincodeService.getInstalledChaincodes().then(chain => {
      this.installedChaincodes = chain;
    });
  }

  installChaincode() {
    this.alertService.info('Sent install chaincode request');
    let formData = new FormData();
    for (let i = 0; i < this.chaincodeFile.length; i++) {
      formData.append('file', this.chaincodeFile[i]);
      formData.append('targets', this.targs);
      formData.append('version', this.installVersion || '1.0');
      formData.append('language', this.installLanguage);
      this.chaincodeService.installChaincode(formData).then(() => {
        this.queryInstalledChaincodes();
      });
    }
  }

  initChaincode() {
    if (this.selectedChain) {
      this.loadI = false;
      let formData;
      try {
        formData = this.createUploadForm();
      } catch (e) {
        this.alertService.error(e);
        return;
      }
      this.alertService.info('Sent instantiate request');
      this.chaincodeService.instantiateChaincode(formData, this.channel).then(() => {
        this.loadI = true;
      }).catch(() => {
        this.loadI = true;
      });
    } else
      this.alertService.error('Select chaincode');
  }

  upgradeChaincode() {
    if (this.selectedChain) {
      let formData;
      try {
        formData = this.createUploadForm();
      } catch (e) {
        this.alertService.error(e);
        return;
      }
      this.alertService.info('Sent upgrade request');
      this.chaincodeService.upgradeChaincode(formData, this.channel).then(() => {
        this.loadI = true;
      }).catch(() => {
        this.loadI = true;
      });
    } else
      this.alertService.error('Select chaincode');
  }

  createUploadForm() {
    this.jsonPolicy = {
      identities: [],
      policy: {}
    };
    let formData = new FormData();
    if (this.privateCollectionFile) {
      for (let i = 0; i < this.privateCollectionFile.length; i++) {
        formData.append('file', this.privateCollectionFile[i]);
      }
    }
    formData.append('channelId', this.channel);
    formData.append('chaincodeId', this.selectedChain.slice(0, this.selectedChain.indexOf(':')));
    formData.append('waitForTransactionEvent', 'true');
    formData.append('chaincodeType', this.initLanguage || 'node');
    formData.append('chaincodeVersion', this.selectedChain.slice(this.selectedChain.indexOf(':') + 1, this.selectedChain.length));
    if (this.initFcn)
      formData.append('fcn', this.initFcn || 'init');
    if (this.initArgs)
      formData.append('args', JSON.stringify(this.parseArgs(this.initArgs)));
    if (this.pol && this.type && this.type !== 'None') {
      let orgsLenght = this.orgs.length === 0 ? this.orgList : this.orgs;
      if (this.type === 'Any')
        this.jsonPolicy.policy["1-of"] = this.countOrgs(orgsLenght.length);
      else if (this.type === 'All')
        this.jsonPolicy.policy[orgsLenght.length + "-of"] = this.countOrgs(orgsLenght.length);
      else {
        if (parseInt((orgsLenght.length / 2), 10) + 1 > orgsLenght.length) {
          throw Error('Majority bigger than orgs count')
        }
        this.jsonPolicy.policy[parseInt((orgsLenght.length / 2), 10) + 1 + "-of"] = this.countOrgs(orgsLenght.length);
      }
      for (let i = 0; i < orgsLenght.length; i++) {
        if (this.selectedRoles.indexOf(orgsLenght[i]) !== -1)
          this.jsonPolicy.identities[i] = {role: {name: "admin", mspId: orgsLenght[i]}};
        else
          this.jsonPolicy.identities[i] = {role: {name: "member", mspId: orgsLenght[i]}};
      }
      formData.append('policy', JSON.stringify(this.jsonPolicy));
    } else if (this.policy)
      formData.append('policy', this.policy.replace(/\s/g, '').trim());

    return formData;
  }

  countOrgs(num) {
    let array = [];
    for (let i = 0; i < num; i++) {
      array.push({"signed-by": i})
    }
    return array;
  }

  queryChaincodes() {
    this.show = false;
    this.chaincodeService.getChaincodes(this.channel).then(chaincodes => {
      this.chaincodeList = chaincodes;
    });
  }

  queryPeers() {
    this.targets = [];
    this.chaincodeService.getPeersForOrgOnChannel(this.channel).then(peers => {
      this.targets = peers;
    });
  }

  queryOrgs() {
    this.chaincodeService.getOrgs(this.channel).then(orgs => {
      this.orgList = orgs.sort();
      this.orgList.splice(orgs.indexOf('orderer'), 1);
    });
  }

  addOrgToChannel() {
    this.alertService.info('Sent invite');
    this.chaincodeService.addOrgToChannel(this.channel, this.newOrg);
    this.newOrg = null;
  }


  getInvoke() {
    this.load = false;
    this.clearAll();
    this.qu = false;
    this.lastTx = null;
    this.show = true;
    let args = this.parseArgs(this.value);
    this.alertService.info('Sent invoke');
    this.chaincodeService.invoke(this.channel, this.selectedChaincode.slice(0, this.selectedChaincode.indexOf(':')), this.fnc, args, this.targs).then(invoke => {
      this.lastTx = invoke.txid;
      this.block = invoke.blockNumber;
      this.qu = true;
      this.load = true;
      Home.output(invoke, 'res');
    }).catch(() => {
      this.load = true;
    });
  }

  getQuery() {
    this.load = false;
    this.clearAll();
    this.lastTx = null;
    this.show = true;
    this.qu = false;
    this.alertService.info('Sent query');
    let args = this.parseArgs(this.value);
    this.chaincodeService.query(this.channel, this.selectedChaincode.slice(0, this.selectedChaincode.indexOf(':')), this.fnc, args, this.targs).then(query => {
      this.lastTx = query;
      for (let i = 0; i < query.length; i++) {
        query[i] = JSON.parse(query[i].replace(/\\"/g, '\\'));
      }
      Home.output(query, 'res');
      this.load = true;
    }).catch(() => {
      this.load = true;
    });
  }

  parseArgs(value) {
    let args = [];
    let kova = false;
    let kovb = false;
    let skoba = 0;
    let skobb = 0;
    let prob = false;
    let comma = false;
    let arg = '';
    if (value) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] === '\'' && !kovb && skoba === 0 && skobb === 0) {
          prob = false;
          if (kova) {
            kova = false;
            args.push(arg.replace(/^\s/g, '').trim());
            arg = '';
          } else {
            kova = true;
          }
        } else if (value[i] === '\"' && !kova && skoba === 0 && skobb === 0) {
          prob = false;
          if (kovb) {
            kovb = false;
            args.push(arg.replace(/^\s/g, '').trim());
            arg = '';
          } else {
            kovb = true;
          }
        } else if (value[i] === '\[' && !kova && !kovb && skobb === 0) {
          prob = false;
          skoba++;
          arg += value[i];
        } else if (value[i] === '\]' && !kova && !kovb && skobb === 0) {
          prob = false;
          skoba--;
          arg += value[i];
          if (skoba === 0) {
            try {
              args.push(JSON.parse(arg.replace(/^\s/g, '').trim()));
            } catch (e) {
              args.push(arg.replace(/^\s/g, '').trim());
            }
            arg = '';
          }
        } else if (value[i] === '\{' && !kova && !kovb && skoba === 0) {
          prob = false;
          skobb++;
          arg += value[i];
        } else if (value[i] === '\}' && !kova && !kovb && skoba === 0) {
          prob = false;
          skobb--;
          arg += value[i];
          if (skobb === 0) {
            args.push(JSON.parse(arg.replace(/^\s/g, '').trim()));
            arg = '';
          }
        } else if (value[i] === ' ' && !kova && !kovb && skoba === 0 && skobb === 0) {
          if (prob && arg !== '') {
            prob = false;
            args.push(arg.replace(/^\s/g, '').trim());
            arg = '';
          } else {
            prob = true;
            if (arg !== '') {
              args.push(arg.replace(/^\s/g, '').trim());
              arg = '';
            }
          }
        } else if (value[i] === ',' && !kova && !kovb && skoba === 0 && skobb === 0) {
          if (comma && arg !== '') {
            comma = false;
            args.push(arg.replace(/^\s/g, '').trim());
            arg = '';
          } else {
            comma = true;
            if (arg !== '') {
              args.push(arg.replace(/^\s/g, '').trim());
              arg = '';
            }
          }
        }
        else {
          arg += value[i];
        }
      }
      if (arg !== '') {
        args.push(arg.replace(/^\s/g, '').trim());
      }
    }
    if (args.length === 1) {
      args = args[0];
    }
    console.log(args);
    return args;
  }

  queryBlocks() {
    this.blocks = [];
    let bl = [];
    this.selectedChaincode = null;
    this.chaincodeService.getLastBlock(this.channel).then(block => {
      for (let i = block - 5; i < block; i++) {
        if (i < 0)
          continue;
        this.chaincodeService.getBlock(this.channel, i).then(block => {
          let txid = [];
          for (let j = 0; j < block.data.data.length; j++) {
            txid.push(block.data.data[j].payload.header.channel_header.tx_id);
          }
          bl.push({blockNumber: block.header.number, txid: txid.join('; ')});
          bl.sort(function (a, b) {
            return a.blockNumber - b.blockNumber;
          });
        });
      }
    });
    bl.sort(function (a, b) {
      return a.blockNumber - b.blockNumber;
    });
    this.blocks = bl;
  }

  updateBlock() {
    this.chaincodeService.getLastBlock(this.channel).then(lastBlock => {
      this.chaincodeService.getBlock(this.channel, lastBlock - 1).then(block => {
        let txid = [];
        if ((lastBlock - 1).toString() === this.block) {
          this.endorses = [];
          Home.clear('json');
          Home.output(block, 'json');
        }
        for (let j = 0; j < block.data.data.length; j++) {
          const info = block.data.data[j].payload;
          if (info.header.channel_header.tx_id === this.lastTx) {
            Home.parseBlock(info);
            this.decodeCert(info.header.signature_header.creator.IdBytes).then(o => {
                this.creator = o.subject.commonName + '@' + o.issuer.organizationName;
                this.creatorCert = o;
              }
            );
            const endorsers = info.data.actions[0].payload.action.endorsements;
            for (let i = 0; i < endorsers.length; i++) {
              this.decodeCert(endorsers[i].endorser.IdBytes).then(o => {
                this.endorses.push(o.subject.commonName);
                this.endorsesCert.push(o);
              });
            }
          }
          txid.push(info.header.channel_header.tx_id);
        }

        if (!(lastBlock - 1 + '' === this.blocks[this.blocks.length - 1].blockNumber)) {
          if (this.blocks.length > 4)
            this.blocks.splice(0, 1);
          this.blocks.push({blockNumber: lastBlock - 1 + '', txid: txid.join('; ')});
        }

      });
    });
  }

  decodeCert(cert) {
    return this.chaincodeService.decodeCert(cert).then(o => {
      return o;
    });
  }

  hideTx() {
    this.lastTx = null;
    this.qu = false;
  }


  queryConsortium() {
    this.consortiumService.query().then((orgs) => {
      this.consortiumMembersList = orgs;
    });
  }

  addToConsortium() {
    this.consortiumService.inviteByName(this.consortiumInviteeName).then((result) => {
      // this.consortiumService.query()
      this.alertService.success(`${this.consortiumInviteeName} added to the consortium`);
      this.queryConsortium();
    });
  }

  queryInstalledWebApps() {
    this.webAppService.getWebApps().then(items => {
      this.installedWebApps = items;
    });
    this.webAppService.getMiddlewares().then(items => {
      this.installedMiddlewares = items;
    });
  }

  installWebApp() {
    let formUrlEncoded = this.createUploadFileForm(this.webAppFile);
    return this.webAppService.installWebApp(formUrlEncoded).then(() => this.queryInstalledWebApps());
  }

  installMiddleware() {
    let formUrlEncoded = this.createUploadFileForm(this.middlewareFile);
    return this.webAppService.installMiddleware(formUrlEncoded).then(() => this.queryInstalledWebApps());
  }

  createUploadFileForm(fileElement, fields) {
    let formData = new FormData();
    for (let i = 0; i < fileElement.length; i++) {
      formData.append('file', fileElement[i]);
    }
    if (fields) Object.keys(fields).forEach(k => formData.append(k, fields[k]));
    return formData;
  }

  static output(inp, id) {
    const formatter = new JSONFormatter(inp);
    const el = document.getElementById(id);
    if (el)
      el.appendChild(formatter.render());
  }

  static clear(id) {
    const el = document.getElementById(id);
    if (el && el.firstChild) {
      while (el.firstChild)
        el.removeChild(el.firstChild);
    }
  }

  clearAll() {
    this.endorsesCert = [];
    for (let i = 0; i < this.endorses.length; i++) {
      let o = this.endorses[i];
      Home.clear(o);
    }
    this.endorses = [];
    Home.clear('info');
    Home.clear('json');
    Home.clear('input');
    Home.clear('reads');
    Home.clear('writes');
    Home.clear('res');
  }

  static parseBlock(block) {
    let action = block.data.actions;
    let rwset = [];
    for (let i = 0; i < action.length; i++) {
      let payload = action[i].payload.chaincode_proposal_payload.input.chaincode_spec.input.args;
      for (let j = 0; j < payload.length; j++) {
        let str = '';
        for (let k = 0; k < payload[j].data.length; k++) {
          str += String.fromCharCode(payload[j].data[k]);
        }
        rwset.push(str);
      }
      Home.output(rwset, 'input');
    }
    rwset = [];
    for (let i = 0; i < action.length; i++) {
      let payload = action[i].payload.action.proposal_response_payload.extension.results.ns_rwset;
      for (let j = 0; j < payload.length; j++) {
        for (let k = 0; k < payload[j].rwset.writes.length; k++) {
          rwset.push(payload[j].rwset.writes[k])
        }
      }
    }
    Home.output(rwset, 'writes');
    rwset = [];
    for (let i = 0; i < action.length; i++) {
      let payload = action[i].payload.action.proposal_response_payload.extension.results.ns_rwset;
      for (let j = 0; j < payload.length; j++) {
        for (let k = 0; k < payload[j].rwset.reads.length; k++) {
          rwset.push(payload[j].rwset.reads[k]);
        }
      }
    }
    Home.output(rwset, 'reads');
  }

  queryCert(o, creator) {
    let btn = document.getElementById(o + 'b').childNodes[0].nodeValue.replace(/^\s/g, '').trim();
    document.getElementById(o + 'b').childNodes[0].nodeValue = btn === 'Show cert' ? 'Hide cert' : 'Show cert';
    const el = document.getElementById(o);
    if (el && el.firstChild) {
      while (el.firstChild)
        el.removeChild(el.firstChild);
    } else if (creator) {
      Home.output(this.creatorCert, o);
    } else {
      for (let i = 0; i < this.endorsesCert.length; i++) {
        if (this.endorsesCert[i].subject.commonName === o) {
          Home.output(this.endorsesCert[i], o);
        }
      }
    }
  }

  select(value) {
    this.pol = value;
  }
}
