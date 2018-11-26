import React from 'react';
import PropTypes from 'prop-types';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import Routes from 'routing/Routes';
import { Button } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import history from 'util/History';

import UserNotification from 'util/UserNotification';
import { DocumentTitle, PageHeader } from 'components/common';
import CombinedProvider from 'injection/CombinedProvider';
import ObjectUtils from 'util/ObjectUtils';
import ContentPackEdit from 'components/content-packs/ContentPackEdit';

import Entity from 'logic/content-packs/Entity';

const { CatalogActions, CatalogStore } = CombinedProvider.get('Catalog');
const { ContentPacksActions, ContentPacksStore } = CombinedProvider.get('ContentPacks');

const EditContentPackPage = createReactClass({
  displayName: 'EditContentPackPage',

  propTypes: {
    params: PropTypes.object.isRequired,
  },

  mixins: [Reflux.connect(CatalogStore), Reflux.connect(ContentPacksStore)],

  getInitialState() {
    return {
      selectedEntities: {},
      selectedStep: undefined,
      appliedParameter: {},
    };
  },

  componentDidMount() {
    ContentPacksActions.get(this.props.params.contentPackId).then(() => {
      const originContentPackRev = this.props.params.contentPackRev;
      const newContentPack = this.state.contentPackRevisions.createNewVersionFromRev(originContentPackRev);
      this.setState({ contentPack: newContentPack });

      CatalogActions.showEntityIndex().then(() => {
        this._getSelectedEntities();
        this._getAppliedParameter();
      });
    });
  },

  _getSelectedEntities() {
    if (!this.state.contentPack || !this.state.entityIndex) {
      return;
    }
    const selectedEntities = this.state.contentPack.entities.reduce((result, entity) => {
      if (this.state.entityIndex[entity.type.name] &&
        this.state.entityIndex[entity.type.name].findIndex((fetchedEntity) => { return fetchedEntity.id === entity.id; }) >= 0) {
        const newResult = result;
        const selectedEntity = { type: entity.type, id: entity.id };
        newResult[entity.type.name] = result[entity.type.name] || [];
        newResult[entity.type.name].push(selectedEntity);
        return newResult;
      }
      return result;
    }, {});
    this.setState({ selectedEntities: selectedEntities });
  },

  _getAppliedParameter() {
    const typeRegEx = RegExp(/\.type$/);
    const appliedParameter = this.state.contentPack.entities.reduce((result, entity) => {
      const paramMap = ObjectUtils.getPaths(entity.data).filter((path) => {
        return typeRegEx.test(path) && ObjectUtils.getValue(entity.data, path) === 'parameter';
      }).map((typePath) => {
        const valuePath = typePath.replace(typeRegEx, '.value');
        const value = ObjectUtils.getValue(entity.data, valuePath);
        const configKey = typePath.replace(typeRegEx, '');
        return { configKey: configKey, paramName: value };
      });
      const newResult = result;
      if (paramMap.length > 0) {
        newResult[entity.id] = paramMap;
      }
      return newResult;
    }, {});
    this.setState({ appliedParameter: appliedParameter });
  },

  _onStateChanged(newState) {
    const contentPack = newState.contentPack || this.state.contentPack;
    const selectedEntities = newState.selectedEntities || this.state.selectedEntities;
    const appliedParameter = newState.appliedParameter || this.state.appliedParameter;
    this.setState({
      contentPack: contentPack,
      selectedEntities: selectedEntities,
      appliedParameter: appliedParameter,
    });
  },

  _onSave() {
    ContentPacksActions.create.triggerPromise(this.state.contentPack.toObject())
      .then(
        () => {
          UserNotification.success('Content pack imported successfully', 'Success!');
          history.push(Routes.SYSTEM.CONTENTPACKS.LIST);
        },
        (response) => {
          const message = 'Error importing content pack, please ensure it is a valid JSON file. Check your ' +
            'Graylog logs for more information.';
          const title = 'Could not import content pack';
          let smallMessage = '';
          if (response.additional && response.additional.body && response.additional.body.message) {
            smallMessage = `<br /><small>${response.additional.body.message}</small>`;
          }
          UserNotification.error(message + smallMessage, title);
        });
  },

  _getEntities(selectedEntities) {
    CatalogActions.getSelectedEntities(selectedEntities).then((result) => {
      const contentPack = this.state.contentPack.toBuilder()
        .entities(result.entities)
        .requires(result.constraints)
        .build();
      const fetchedEntities = result.entities.map(e => Entity.of(e));
      this.setState({ contentPack: contentPack, fetchedEntities });
    });
  },

  render() {
    return (
      <DocumentTitle title="Content packs">
        <span>
          <PageHeader title="Edit content pack">
            <span>
              Content packs accelerate the set up process for a specific data source. A content pack can include inputs/extractors, streams, and dashboards.
            </span>

            <span>
              Find more content packs in {' '}
              <a href="https://marketplace.graylog.org/" target="_blank" rel="noopener noreferrer">the Graylog Marketplace</a>.
            </span>

            <div>
              <LinkContainer to={Routes.SYSTEM.CONTENTPACKS.LIST}>
                <Button bsStyle="info">Content Packs</Button>
              </LinkContainer>
            </div>
          </PageHeader>
          <ContentPackEdit contentPack={this.state.contentPack}
                           onGetEntities={this._getEntities}
                           onStateChange={this._onStateChanged}
                           fetchedEntities={this.state.fetchedEntities}
                           selectedEntities={this.state.selectedEntities}
                           entityIndex={this.state.entityIndex}
                           appliedParameter={this.state.appliedParameter}
                           onSave={this._onSave}
          />
        </span>
      </DocumentTitle>
    );
  },
});

export default EditContentPackPage;
