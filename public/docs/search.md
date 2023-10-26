<topicKey search/>
<topicBack id="topicNext" link="ownerref"/>
<topicNext id="topicBack" link="security"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

#### Search

---

Search Kubernetes defined resources.

<!-- <div style="margin-left: 150px;">
    <iframe width="700" height="390" src="https://www.youtube.com/embed/_YY3190mlkw"></iframe>
</div> -->

---

Search provides the ability to search all K8s resources.  

The Search value input field can be used standalone or in conjunction with the Namespace(s) and/or 
Kind(s) inputs. All data provided in the 'Search value' field is case sensitive.

The Namespace(s) and Kind(s) searches are performed before searching with the 'Search value' input data.

---

The following are the options when using the 'Search value' input field.

##### Full search

Enter any text in the 'Search value' input field. Kubernetes resource definitions will be searched for the value regardless of where the value is located.

##### Limited searches

There are three types of limited searches. Each requires a specific keyword to indicate the associated search is to be performed. 
Keywords must be entered in lowercase followed with a colon.

| Limited search type | Search Key |
|---|---|
| Search for a resource by name. | name: |
| Search labels of the metadata section. | labels: |
| Search annotations of the metadata section. | annotations: |

---

##### Search results

The search results are presented in a table format displaying three fields, namespace, kind, and name.     

Information displayed in the table can be __clicked on__ to view the associated resource yaml.  Filtering the table view is available.  Click the open filter button in the results table to select the filter types to be applied.  More than one table filter can be applied at the same time.

---

##### Example searches:

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

<!-- <a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a> -->


