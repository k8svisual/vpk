<topicKey search/>
<topicBack id="topicNext" link="toc"/>
<topicNext id="topicBack" link="containerimages"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Search (tab)


Search tab provides the ability to search all K8s resources in the selected snapshot.  

The Search value input field can be used standalone or in conjunction with the Namespace(s) and/or Kind(s) inputs. All data provided in the 'Search value' field is case sensitive.

The Namespace(s) and Kind(s) searches are performed __before__ searching with the 'Search value' input data.

### Search screen

The following Search screen shows the selection of two Kinds, ConfigMap and Secret within the selected Namespace: kube-public.  A table with the search results is shown below the entered parameters. 

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_search.png" width="1024">
</p>

---

The following are the options when using the 'Search value' input field.

### Full search

Enter any text in the 'Search value' input field. All Kubernetes resource definitions will be searched for the value regardless of where the value is located.

### Limited searches

There are three types of limited searches. Each requires a specific keyword to indicate the associated search is to be performed. 

Keywords must be entered in lowercase followed with a colon.

| Limited Search Type | Search Key |
|---|---|
| Search for a resource by name. | __name:__ |
| Search labels of the metadata section. | __labels:__ |
| Search annotations of the metadata section. | __annotations:__ |

Searching for a specific value in the labels or annotations can be achieved by using an additional parameter of "__::value::__". This key is then followed by a space and the value to locate.  Review the Example searches section of this document for examples of this parameter use.

---

### Search results

The search results are presented in a table format displaying three fields, namespace, kind, and name.     

Information displayed in the table can be clicked on to view the associated resource definition.  

Filtering the results table view is available by entering a value in the "__Search__" field at the top of the table.

---

### Example searches:

| Description | Search value |
|---|---|
| Search all resources for any occurrence of text 'a7be5c9d'. | a7be5c9d |
| Search for resources defined with the name 'bookinfo'. | name: bookinfo |
| Search resource metadata labels that match 'app.kubernetes.io'. | labels: app.kubernetes.io |
| Search resource metadata labels that match 'release' and have the value 'production'. | labels: release ::value:: production |
| Search all resource metadata labels for the value 'server'. | labels: * ::value:: server |
| Search resource metadata annotations that match 'productName'. | annotations: productName |
| Search resource metadata annotations that match 'network' and have the value 'wifi'. | annotations: network ::value:: wifi |
| Search all resource metadata annotations for the value 'click'. | annotations: * ::value:: operational-task |

---

### Search results table controls

The search results table has several controls.  There are identified in the following image.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_search_table.png" width="1024">
</p>

<hr style="border:1px solid #aaaaaa">


