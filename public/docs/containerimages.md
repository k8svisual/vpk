<topicKey containerimages/>
<topicBack id="topicNext" link="search"/>
<topicNext id="topicBack" link="eventmsgs"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Container Images (tab)

Container Images provides two views, table and graph, of the container images defined within the K8s cluster by Repository.

From the Select Repository drop-down select a single repository.  Once a repository has been selected press the "__View selected repository__" button. 

If there is no selected repository a warning message is displayed. The results are a table view of the container images for the selected repository.  The __Toggle Views (table/graph)__ button can be pressed to toggle between the two views.

### Table

In the table view the __Search__ input field can be used to filter what is shown in the table. The checkbox fields on the left-hand side of the table can be selected to filter to only the selected rows.  If selected press the the button __Graph selected tab rows__ to limit what is shown in the Graph view.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_container_images_table.png" width="1024">
</p>


### Graph

The graph view is a scrollable view of the selected Repository, Image, Namespace, workload, and Container / Init-Container.  Clicking
any of the icons other than the workload icon will return a message that 'No resource data available for the selected item.'.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_container_images_graph.png" width="1024">
</p>

---

#### Graph Icons

The following are the icons that are displayed in the Graph view.  Press the __Legend__ button to view additional information 
regarding this tab.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_container_images_legend.png">
</p>

<hr style="border:1px solid #aaaaaa">